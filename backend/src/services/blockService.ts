import { Types } from 'mongoose';
import BlockedUser from '../models/BlockedUser.js';
import Request from '../models/Request.js';
import Chat from '../models/Chat.js';
import { AppError } from '../utils/errors.js';
import { IBlockedUser } from '../types/index.js';
import { getIO } from '../config/socket.js';
import logger from '../utils/logger.js';

/**
 * Blocks a user. The friendship record is intentionally preserved so that
 * unblocking immediately restores chat access without requiring a new friend
 * request. The shared DM is hidden from the blocker's list. Emits
 * `chat:status_changed` with status `'blocked'` to both participants.
 */
export const blockUser = async (blockerId: Types.ObjectId, blockedId: string): Promise<IBlockedUser> => {
  if (blockerId.toString() === blockedId) throw new AppError('Cannot block yourself', 400);
  const existing = await BlockedUser.findOne({ blocker: blockerId, blocked: blockedId });
  if (existing) throw new AppError('User already blocked', 409);

  await Chat.updateMany(
    { isGroup: false, members: { $all: [blockerId, blockedId] } },
    { $addToSet: { hiddenBy: blockerId } }
  );

  const block = await BlockedUser.create({ blocker: blockerId, blocked: blockedId });

  try {
    const io = getIO();
    const chat = await Chat.findOne({ isGroup: false, members: { $all: [blockerId, blockedId] } });
    if (chat) {
      chat.members.forEach((memberId) => {
        io.to(memberId.toString()).emit('chat:status_changed', {
          chatId: chat._id.toString(), status: 'blocked', by: blockerId.toString(),
        });
      });
    }
  } catch (e) {
    logger.warn(`[blockUser] Socket error: ${(e as Error).message}`);
  }

  return block;
};

/**
 * Removes an existing block. Ensures an accepted friendship record exists
 * (creating one if missing) so both parties can chat immediately. Un-hides
 * the DM and emits `chat:status_changed` with status `'unblocked'`.
 */
export const unblockUser = async (blockerId: Types.ObjectId, blockedId: string): Promise<IBlockedUser> => {
  const result = await BlockedUser.findOneAndDelete({ blocker: blockerId, blocked: blockedId });
  if (!result) throw new AppError('Block not found', 404);

  const existingRequest = await Request.findOne({
    $or: [
      { sender: blockerId, recipient: blockedId },
      { sender: blockedId, recipient: blockerId },
    ],
  });
  if (!existingRequest) {
    await Request.create({ sender: blockerId, recipient: blockedId, status: 'accepted' });
  } else if (existingRequest.status !== 'accepted') {
    existingRequest.status = 'accepted';
    await existingRequest.save();
  }

  try {
    const io = getIO();
    const chat = await Chat.findOne({ isGroup: false, members: { $all: [blockerId, blockedId] } });
    if (chat) {
      await Chat.findByIdAndUpdate(chat._id, { $pull: { hiddenBy: blockerId } });
      chat.members.forEach((memberId) => {
        io.to(memberId.toString()).emit('chat:status_changed', {
          chatId: chat._id.toString(), status: 'unblocked', by: blockerId.toString(),
        });
      });
    }
  } catch (e) {
    logger.warn(`[unblockUser] Socket error: ${(e as Error).message}`);
  }

  return result;
};

/** Returns all users blocked by the given user, with populated user details. */
export const getBlockedUsers = async (userId: Types.ObjectId): Promise<IBlockedUser[]> =>
  BlockedUser.find({ blocker: userId })
    .populate('blocked', 'username fullName avatar')
    .sort({ createdAt: -1 });

/** Returns true if `blockerId` has an active block on `blockedId`. */
export const isBlocked = async (blockerId: Types.ObjectId, blockedId: string): Promise<boolean> => {
  const exists = await BlockedUser.findOne({ blocker: blockerId, blocked: blockedId });
  return !!exists;
};

/** Returns both block directions: `{ blockedByMe, blockedByThem }`. */
export const checkBlockStatus = async (
  viewerId: Types.ObjectId,
  targetId: string
): Promise<{ blockedByMe: boolean; blockedByThem: boolean }> => {
  const [byMe, byThem] = await Promise.all([
    BlockedUser.findOne({ blocker: viewerId, blocked: targetId }),
    BlockedUser.findOne({ blocker: targetId, blocked: viewerId.toString() }),
  ]);
  return { blockedByMe: !!byMe, blockedByThem: !!byThem };
};
