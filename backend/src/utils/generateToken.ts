import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Types } from "mongoose";

export const generateToken = (id: Types.ObjectId): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRE ??
      "15m") as jwt.SignOptions["expiresIn"],
  });
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString("hex");
};

export const generateOtp = (): { otp: string; hash: string } => {
  const otp = crypto.randomInt(100000, 1000000).toString();
  const hash = crypto.createHash("sha256").update(otp).digest("hex");
  return { otp, hash };
};
