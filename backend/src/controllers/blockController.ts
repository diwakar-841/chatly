import { Request, Response, NextFunction } from 'express';
import * as blockService from '../services/blockService.js';
import { AuthRequest } from '../types/index.js';

/** Blocks the target user; prevents messaging and hides presence in both directions. */
export const blockUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const block = await blockService.blockUser((req as AuthRequest).user._id, req.params.userId);
    res.status(201).json(block);
  } catch (err) { next(err); }
};

/** Removes an existing block between the caller and the target user. */
export const unblockUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await blockService.unblockUser((req as AuthRequest).user._id, req.params.userId);
    res.json({ message: 'User unblocked' });
  } catch (err) { next(err); }
};

/** Returns the list of users blocked by the caller. */
export const getBlockedUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const blocked = await blockService.getBlockedUsers((req as AuthRequest).user._id);
    res.json(blocked);
  } catch (err) { next(err); }
};

/**
 * Returns both block directions between the caller and the target:
 * `{ blockedByMe, blockedByThem }`.
 */
export const checkBlock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = await blockService.checkBlockStatus(
      (req as AuthRequest).user._id,
      req.params.userId
    );
    res.json(status);
  } catch (err) { next(err); }
};
