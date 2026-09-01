import { Request, Response, NextFunction } from "express";
import * as profileService from "../services/profileService.js";
import { AuthRequest, ProfileUpdates } from "../types/index.js";


export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await profileService.getProfile(
      req.params.userId,
      (req as AuthRequest).user._id,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
};


export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await profileService.updateProfile(
      (req as AuthRequest).user._id,
      req.body as ProfileUpdates,
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
};


export const updateAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }
    const avatarUrl = req.file.path;
    const user = await profileService.updateAvatar(
      (req as AuthRequest).user._id,
      avatarUrl,
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
};


export const searchUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await profileService.searchUsers(
      (req.query.q as string) ?? "",
      (req as AuthRequest).user._id,
      page,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
