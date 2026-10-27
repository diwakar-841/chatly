import { Types } from "mongoose";
import Notification from "../models/Notification.js";
import { AppError } from "../utils/errors.js";
import { INotification } from "../types/index.js";

export const getNotifications = async (
  userId: Types.ObjectId,
  page = 1,
): Promise<INotification[]> => {
  const limit = 20;
  const skip = (page - 1) * limit;
  return Notification.find({ recipient: userId })
    .populate("sender", "username fullName avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

export const markAllRead = async (userId: Types.ObjectId): Promise<void> => {
  await Notification.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true },
  );
};

export const markOneRead = async (
  notificationId: string,
  userId: Types.ObjectId,
): Promise<INotification> => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true },
    { new: true },
  );
  if (!notification) {
    throw new AppError("Notification not found", 404);
  }
  return notification;
};

export const getUnreadCount = async (
  userId: Types.ObjectId,
): Promise<number> => {
  return Notification.countDocuments({ recipient: userId, isRead: false });
};

export const deleteOne = async (
  notificationId: string,
  userId: Types.ObjectId,
): Promise<void> => {
  const result = await Notification.findOneAndDelete({
    _id: notificationId,
    recipient: userId,
  });
  if (!result) {
    throw new AppError("Notification not found", 404);
  }
};

export const deleteAll = async (userId: Types.ObjectId): Promise<void> => {
  await Notification.deleteMany({ recipient: userId });
};
