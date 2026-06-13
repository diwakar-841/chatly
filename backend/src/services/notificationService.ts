import { Types } from 'mongoose';
import Notification from '../models/Notification.js';
import { AppError } from '../utils/errors.js';
import { INotification } from '../types/index.js';

/** Returns a paginated list of notifications for the user, newest first. */
export const getNotifications = async (userId: Types.ObjectId, page = 1): Promise<INotification[]> => {
  const limit = 20;
  const skip = (page - 1) * limit;
  return Notification.find({ recipient: userId })
    .populate('sender', 'username fullName avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/** Bulk-marks every unread notification for the user as read. */
export const markAllRead = async (userId: Types.ObjectId): Promise<void> => {
  await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true });
};

/** Marks a single notification as read and returns the updated document. */
export const markOneRead = async (
  notificationId: string, userId: Types.ObjectId
): Promise<INotification | null> =>
  Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true },
    { new: true }
  );

/** Returns the count of unread notifications for the user. */
export const getUnreadCount = async (userId: Types.ObjectId): Promise<number> =>
  Notification.countDocuments({ recipient: userId, isRead: false });

/** Deletes a single notification; throws 404 if not owned by the user. */
export const deleteOne = async (notificationId: string, userId: Types.ObjectId): Promise<void> => {
  const result = await Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
  if (!result) throw new AppError('Notification not found', 404);
};

/** Deletes every notification for the given user. */
export const deleteAll = async (userId: Types.ObjectId): Promise<void> => {
  await Notification.deleteMany({ recipient: userId });
};
