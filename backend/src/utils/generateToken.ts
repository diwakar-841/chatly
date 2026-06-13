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

/** Generates a password-reset token and its SHA-256 hash for safe DB storage. */
export const generateResetToken = (): { resetToken: string; hash: string } => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(resetToken).digest('hex');
  return { resetToken, hash };
};
