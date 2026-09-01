import { Types } from "mongoose";
import Request from "../models/Request.js";
import BlockedUser from "../models/BlockedUser.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { getIO } from "../config/socket.js";
import logger from "../utils/logger.js";
import { AppError } from "../utils/errors.js";
import { IRequest } from "../types/index.js";
import { getOrCreateDM } from "./chatService.js";
import Chat from "../models/Chat.js";

export const sendRequest = async (
  senderId: Types.ObjectId,
  recipientId: string,
): Promise<IRequest> => {
  if (senderId.toString() === recipientId.toString()) {
    throw new AppError("Cannot send request to yourself", 400);
  }

  const isBlocked = await BlockedUser.findOne({
    $or: [
      { blocker: senderId, blocked: recipientId },
      { blocker: recipientId, blocked: senderId },
    ],
  });
  if (isBlocked) {
    throw new AppError("Unable to send request", 400);
  }

  const existing = await Request.findOne({
    $or: [
      { sender: senderId, recipient: recipientId },
      { sender: recipientId, recipient: senderId },
    ],
  });
  if (existing) {
    throw new AppError("Request already exists", 409);
  }

  const request = await Request.create({
    sender: senderId,
    recipient: recipientId,
  });

  const sender = await User.findById(senderId).select(
    "username fullName avatar",
  );
  const notification = await Notification.create({
    recipient: recipientId,
    sender: senderId,
    type: "request",
    message: `${sender?.username ?? "Someone"} sent you a friend request`,
  });

  try {
    const io = getIO();
    io.to(recipientId.toString()).emit("notification:new", notification);
    const populated = await request.populate(
      "sender",
      "username fullName avatar",
    );
    io.to(recipientId.toString()).emit("request:new", populated);
  } catch (socketErr) {
    logger.warn(
      `[sendRequest] Socket error for recipient ${recipientId}: ${(socketErr as Error).message}`,
    );
  }

  return request;
};

export const respondToRequest = async (
  requestId: string,
  userId: Types.ObjectId,
  action: string,
): Promise<IRequest> => {
  if (action !== "accept" && action !== "reject") {
    throw new AppError('Action must be "accept" or "reject"', 400);
  }

  const request = await Request.findOne({ _id: requestId, recipient: userId });
  if (!request) {
    throw new AppError("Request not found", 404);
  }
  if (request.status !== "pending") {
    throw new AppError("Request already responded to", 409);
  }

  request.status = action === "accept" ? "accepted" : "rejected";
  await request.save();
  await request.populate([
    { path: "sender", select: "username fullName avatar isOnline" },
    { path: "recipient", select: "username fullName avatar isOnline" },
  ]);

  if (action === "accept") {
    const notification = await Notification.create({
      recipient: request.sender,
      sender: userId,
      type: "request_accepted",
      message: "Your friend request was accepted",
    });
    try {
      getIO()
        .to(request.sender.toString())
        .emit("notification:new", notification);
      getIO()
        .to(request.sender.toString())
        .emit("request:accepted", { requestId, by: userId });
    } catch (socketErr) {
      logger.warn(
        `[respondToRequest] Socket error: ${(socketErr as Error).message}`,
      );
    }

    try {
      const chat = await getOrCreateDM(userId, request.sender.toString());
      const io = getIO();
      io.to(userId.toString()).emit("chat:new", chat);
      io.to(request.sender.toString()).emit("chat:new", chat);
    } catch {
      
    }
  }

  return request;
};

export const withdrawRequest = async (
  requestId: string,
  senderId: Types.ObjectId,
): Promise<void> => {
  const request = await Request.findOne({
    _id: requestId,
    sender: senderId,
    status: "pending",
  });
  if (!request) {
    throw new AppError("Request not found", 404);
  }
  await request.deleteOne();
};

export const getRequestStatus = async (
  userId: Types.ObjectId,
  targetUserId: string,
): Promise<{
  status: string;
  requestId: string | null;
  direction: string | null;
}> => {
  
  const blocked = await BlockedUser.findOne({
    $or: [
      { blocker: userId, blocked: targetUserId },
      { blocker: targetUserId, blocked: userId },
    ],
  });
  if (blocked) {
    return { status: "blocked", requestId: null, direction: null };
  }

  const request = await Request.findOne({
    $or: [
      { sender: userId, recipient: targetUserId },
      { sender: targetUserId, recipient: userId },
    ],
  });
  if (!request) {
    return { status: "none", requestId: null, direction: null };
  }

  const direction =
    request.sender.toString() === userId.toString() ? "sent" : "received";

  if (request.status === "accepted") {
    return { status: "accepted", requestId: request._id.toString(), direction };
  }
  if (request.status === "pending") {
    return {
      status: direction === "sent" ? "pending_sent" : "pending_received",
      requestId: request._id.toString(),
      direction,
    };
  }

  
  return { status: "none", requestId: null, direction: null };
};

export const getPendingRequests = async (
  userId: Types.ObjectId,
): Promise<IRequest[]> => {
  return Request.find({ recipient: userId, status: "pending" })
    .populate("sender", "username fullName avatar isOnline")
    .sort({ createdAt: -1 });
};

export const getSentRequests = async (
  userId: Types.ObjectId,
): Promise<IRequest[]> => {
  return Request.find({ sender: userId })
    .populate("recipient", "username fullName avatar isOnline")
    .sort({ createdAt: -1 });
};

export const unfriend = async (
  userId: Types.ObjectId,
  targetUserId: string,
): Promise<void> => {
  const request = await Request.findOne({
    $or: [
      { sender: userId, recipient: targetUserId, status: "accepted" },
      { sender: targetUserId, recipient: userId, status: "accepted" },
    ],
  });
  if (!request) {
    throw new AppError("No accepted friendship found", 404);
  }
  await request.deleteOne();

  try {
    const io = getIO();
    const chat = await Chat.findOne({
      isGroup: false,
      members: { $all: [userId, targetUserId] },
    });
    if (chat) {
      chat.members.forEach((memberId) => {
        io.to(memberId.toString()).emit("chat:status_changed", {
          chatId: chat._id.toString(),
          status: "unfriended",
          by: userId.toString(),
        });
      });
    }
  } catch (e) {
    logger.warn(`[unfriend] Socket error: ${(e as Error).message}`);
  }
};
