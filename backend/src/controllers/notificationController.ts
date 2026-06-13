import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notificationService.js';
import { AuthRequest } from '../types/index.js';

/** Returns a paginated list of notifications for the caller. */
export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const notifications = await notificationService.getNotifications((req as AuthRequest).user._id, page);
    res.json(notifications);
  } catch (err) { next(err); }
};

/** Marks all notifications for the caller as read in a single bulk update. */
export const markAllRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await notificationService.markAllRead((req as AuthRequest).user._id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
};

/** Marks a single notification as read and returns the updated document. */
export const markOneRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const n = await notificationService.markOneRead(req.params.id, (req as AuthRequest).user._id);
    res.json(n);
  } catch (err) { next(err); }
};

/** Returns the count of unread notifications for the caller. */
export const getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const count = await notificationService.getUnreadCount((req as AuthRequest).user._id);
    res.json({ count });
  } catch (err) { next(err); }
};

/** Deletes a single notification owned by the caller. */
export const deleteOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await notificationService.deleteOne(req.params.id, (req as AuthRequest).user._id);
    res.json({ message: 'Notification deleted' });
  } catch (err) { next(err); }
};

/** Deletes every notification for the caller. */
export const deleteAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await notificationService.deleteAll((req as AuthRequest).user._id);
    res.json({ message: 'All notifications deleted' });
  } catch (err) { next(err); }
};
