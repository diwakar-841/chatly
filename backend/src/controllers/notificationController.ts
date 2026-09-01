import { Request, Response, NextFunction } from "express";
import * as notificationService from "../services/notificationService.js";
import { AuthRequest } from "../types/index.js";

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const notifications = await notificationService.getNotifications(
      (req as AuthRequest).user._id,
      page,
    );
    res.json(notifications);
  } catch (err) {
    next(err);
  }
};

export const markAllRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await notificationService.markAllRead((req as AuthRequest).user._id);
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
};

export const markOneRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const n = await notificationService.markOneRead(
      req.params.id,
      (req as AuthRequest).user._id,
    );
    res.json(n);
  } catch (err) {
    next(err);
  }
};

export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const count = await notificationService.getUnreadCount(
      (req as AuthRequest).user._id,
    );
    res.json({ count });
  } catch (err) {
    next(err);
  }
};

export const deleteOne = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await notificationService.deleteOne(
      req.params.id,
      (req as AuthRequest).user._id,
    );
    res.json({ message: "Notification deleted" });
  } catch (err) {
    next(err);
  }
};

export const deleteAll = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await notificationService.deleteAll((req as AuthRequest).user._id);
    res.json({ message: "All notifications deleted" });
  } catch (err) {
    next(err);
  }
};
