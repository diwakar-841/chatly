import { Request, Response, NextFunction } from "express";
import * as blockService from "../services/blockService.js";
import { AuthRequest } from "../types/index.js";

export const blockUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const block = await blockService.blockUser(
      (req as AuthRequest).user._id,
      req.params.userId,
    );
    res.status(201).json(block);
  } catch (err) {
    next(err);
  }
};

export const unblockUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await blockService.unblockUser(
      (req as AuthRequest).user._id,
      req.params.userId,
    );
    res.json({ message: "User unblocked" });
  } catch (err) {
    next(err);
  }
};

export const getBlockedUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const blocked = await blockService.getBlockedUsers(
      (req as AuthRequest).user._id,
    );
    res.json(blocked);
  } catch (err) {
    next(err);
  }
};

export const checkBlock = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const status = await blockService.checkBlockStatus(
      (req as AuthRequest).user._id,
      req.params.userId,
    );
    res.json(status);
  } catch (err) {
    next(err);
  }
};
