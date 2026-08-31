import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Types } from 'mongoose';

/** Signs a short-lived JWT access token for the given user ID. */
export const generateToken = (id: Types.ObjectId): string =>
  jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRE ?? '15m') as jwt.SignOptions['expiresIn'],
  });

/** Generates a cryptographically random refresh token string. */
export const generateRefreshToken = (): string =>
  crypto.randomBytes(64).toString('hex');

/**
 * Generates a random 6-digit numeric OTP and its SHA-256 hash for safe DB
 * storage. The raw `otp` is emailed to the user (via EmailJS) and never
 * persisted — only `hash` is stored, so a DB leak doesn't expose live codes.
 */
export const generateOtp = (): { otp: string; hash: string } => {
  const otp = crypto.randomInt(100000, 1000000).toString();
  const hash = crypto.createHash('sha256').update(otp).digest('hex');
  return { otp, hash };
};
