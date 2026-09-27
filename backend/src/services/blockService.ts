import { Types } from "mongoose";
import BlockedUser from "../models/BlockedUser.js";
import Chat from "../models/Chat.js";
import { AppError } from "../utils/errors.js";
import { IBlockedUser } from "../types/index.js";
import { getIO } from "../config/socket.js";
import logger from "../utils/logger.js";

export const blockUser = async (
  blockerId: Types.ObjectId,
  blockedId: string,
): Promise<IBlockedUser> => {
  if (blockerId.toString() === blockedId) {
    throw new AppError("Cannot block yourself", 400);
  }
  const existing = await BlockedUser.findOne({
    blocker: blockerId,
    blocked: blockedId,
  });
  if (existing) {
    throw new AppError("User already blocked", 409);
  }

  await Chat.updateMany(
    { isGroup: false, members: { $all: [blockerId, blockedId] } },
    { $addToSet: { hiddenBy: blockerId } },
  );

  const block = await BlockedUser.create({
    blocker: blockerId,
    blocked: blockedId,
  });

  try {
    const io = getIO();
    const chat = await Chat.findOne({
      isGroup: false,
      members: { $all: [blockerId, blockedId] },
    });
    if (chat) {
      chat.members.forEach((memberId) => {
        io.to(memberId.toString()).emit("chat:status_changed", {
          chatId: chat._id.toString(),
          status: "blocked",
          by: blockerId.toString(),
        });
      });
    }
  } catch (e) {
    logger.warn(`[blockUser] Socket error: ${(e as Error).message}`);
  }

  return block;
};

export const unblockUser = async (
  blockerId: Types.ObjectId,
  blockedId: string,
): Promise<IBlockedUser> => {
  const result = await BlockedUser.findOneAndDelete({
    blocker: blockerId,
    blocked: blockedId,
  });
  if (!result) {
    throw new AppError("Block not found", 404);
  }

  

  try {
    const io = getIO();
    const chat = await Chat.findOne({
      isGroup: false,
      members: { $all: [blockerId, blockedId] },
    });
    if (chat) {
      await Chat.findByIdAndUpdate(chat._id, {$pull: { hiddenBy: blockerId },});
      chat.members.forEach((memberId) => {
        io.to(memberId.toString()).emit("chat:status_changed", {
          chatId: chat._id.toString(),
          status: "unblocked",
          by: blockerId.toString(),
        });
      });
    }
  } catch (e) {
    logger.warn(`[unblockUser] Socket error: ${(e as Error).message}`);
  }

  return result;
};

export const getBlockedUsers = async (
  userId: Types.ObjectId,
): Promise<IBlockedUser[]> => {
  return BlockedUser.find({ blocker: userId })
    .populate("blocked", "username fullName avatar")
    .sort({ createdAt: -1 });
};

export const isBlocked = async (
  blockerId: Types.ObjectId,
  blockedId: string,
): Promise<boolean> => {
  const exists = await BlockedUser.findOne({
    blocker: blockerId,
    blocked: blockedId,
  });
  return !!exists;
};

export const checkBlockStatus = async (
  viewerId: Types.ObjectId,
  targetId: string,
): Promise<{ blockedByMe: boolean; blockedByThem: boolean }> => {
  const [byMe, byThem] = await Promise.all([
    BlockedUser.findOne({ blocker: viewerId, blocked: targetId }),
    BlockedUser.findOne({ blocker: targetId, blocked: viewerId.toString() }),
  ]);
  return { blockedByMe: !!byMe, blockedByThem: !!byThem };
};
