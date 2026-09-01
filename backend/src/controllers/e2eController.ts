import { Request, Response, NextFunction } from "express";
import User from "../models/User.js";
import { AuthRequest } from "../types/index.js";
import { AppError } from "../utils/errors.js";

export const updatePublicKey = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { publicKey } = req.body as { publicKey?: string };
    if (
      !publicKey ||
      typeof publicKey !== "string" ||
      publicKey.length < 32 ||
      publicKey.length > 100
    ) {
      throw new AppError("Invalid public key", 400);
    }
    await User.findByIdAndUpdate((req as AuthRequest).user._id, { publicKey });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const getUserPublicKey = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId).select("publicKey");
    if (!user) {
      throw new AppError("User not found", 404);
    }
    res.json({ publicKey: user.publicKey ?? "" });
  } catch (err) {
    next(err);
  }
};
