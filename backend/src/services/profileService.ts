import { Types } from 'mongoose';
import User from '../models/User.js';
import BlockedUser from '../models/BlockedUser.js';
import Request from '../models/Request.js';
import escapeRegex from '../utils/escapeRegex.js';
import { AppError } from '../utils/errors.js';
import { IUser, ProfileUpdates, PaginatedResult } from '../types/index.js';

/**
 * Returns the target user's profile with visibility flags. Self-requests
 * always get full access. Any active block (either direction) returns 403.
 * Private accounts grant canChat only when an accepted friendship exists.
 */
export const getProfile = async (
  targetUserId: string, requesterId: Types.ObjectId
): Promise<{ user: IUser; isSelf: boolean; canView: boolean; canChat: boolean }> => {
  const user = await User.findById(targetUserId).select(
    '-password -resetPasswordOtp -resetPasswordOtpExpire -verifyEmailOtp -verifyEmailOtpExpire'
  );
  if (!user) throw new AppError('User not found', 404);

  if (targetUserId.toString() === requesterId.toString()) {
    return { user, isSelf: true, canView: true, canChat: true };
  }

  const isBlocked = await BlockedUser.findOne({
    $or: [
      { blocker: requesterId, blocked: targetUserId },
      { blocker: targetUserId, blocked: requesterId },
    ],
  });
  if (isBlocked) throw new AppError('Unable to view this profile', 403);

  if (!user.isPrivate) return { user, isSelf: false, canView: true, canChat: true };

  const accepted = await Request.findOne({
    $or: [
      { sender: requesterId, recipient: targetUserId, status: 'accepted' },
      { sender: targetUserId, recipient: requesterId, status: 'accepted' },
    ],
  });

  return { user, isSelf: false, canView: true, canChat: !!accepted };
};

/** Updates only the whitelisted profile fields; returns the sanitised user document. */
export const updateProfile = async (
  userId: Types.ObjectId, updates: ProfileUpdates
): Promise<IUser | null> => {
  const allowed: (keyof ProfileUpdates)[] = ['fullName', 'bio', 'isPrivate', 'education', 'experience'];
  const filtered: Partial<ProfileUpdates> = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) (filtered as Record<string, unknown>)[key] = updates[key];
  }
  return User.findByIdAndUpdate(userId, filtered, { new: true, runValidators: true }).select(
    '-password -resetPasswordOtp -resetPasswordOtpExpire -verifyEmailOtp -verifyEmailOtpExpire'
  );
};

/** Replaces the user's avatar URL with the new Cloudinary URL. */
export const updateAvatar = async (userId: Types.ObjectId, avatarUrl: string): Promise<IUser | null> =>
  User.findByIdAndUpdate(userId, { avatar: avatarUrl }, { new: true }).select('-password');

/**
 * Searches users by username or full name, excluding the requester and any
 * users involved in a block relationship. Annotates each result with a
 * `friendStatus` field derived from existing Request records.
 */
export const searchUsers = async (
  query: string, requesterId: Types.ObjectId, page = 1
): Promise<PaginatedResult<IUser & { friendStatus?: string }>> => {
  const limit = 20;
  const skip = (page - 1) * limit;

  const blockedRelations = await BlockedUser.find({
    $or: [{ blocker: requesterId }, { blocked: requesterId }],
  });
  const blockedIds = blockedRelations.map((b) =>
    b.blocker.toString() === requesterId.toString() ? b.blocked : b.blocker
  );

  const baseFilter = {
    username: { $exists: true, $ne: '' },
    _id: { $nin: [...blockedIds, requesterId] },
  };

  const trimmed = query.trim();
  const filter = trimmed
    ? {
        ...baseFilter,
        $or: [
          { username: { $regex: escapeRegex(trimmed), $options: 'i' } },
          { fullName: { $regex: escapeRegex(trimmed), $options: 'i' } },
        ],
      }
    : baseFilter;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('username fullName avatar isPrivate isOnline lastSeen isVerified')
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  const userIds = users.map((u) => u._id);
  const requests = await Request.find({
    $or: [
      { sender: requesterId, recipient: { $in: userIds } },
      { sender: { $in: userIds }, recipient: requesterId },
    ],
  });

  const statusMap = new Map<string, string>();
  for (const req of requests) {
    const otherId = req.sender.toString() === requesterId.toString()
      ? req.recipient.toString()
      : req.sender.toString();
    statusMap.set(otherId, req.status);
  }

  const data = users.map((u) => {
    const obj = u.toObject() as IUser & { friendStatus?: string };
    obj.friendStatus = statusMap.get(u._id.toString()) ?? 'none';
    return obj;
  });

  return { data, total, page, hasMore: skip + users.length < total };
};
