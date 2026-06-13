import crypto from 'crypto';
import { Types } from 'mongoose';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { generateToken, generateRefreshToken, generateResetToken } from '../utils/generateToken.js';
import { sendPasswordReset, sendVerificationEmail } from './emailService.js';
import { AppError } from '../utils/errors.js';
import { AuthResult, SafeUser } from '../types/index.js';
import logger from '../utils/logger.js';

const REFRESH_TOKEN_EXPIRE_DAYS = 30;

/** Returns the SHA-256 hash of the given token string. */
const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/** Strips sensitive fields and returns a safe user object for API responses. */
const safeUser = (user: InstanceType<typeof User>): SafeUser => ({
  _id: user._id as Types.ObjectId,
  username: user.username,
  email: user.email,
  fullName: user.fullName,
  avatar: user.avatar,
  isPrivate: user.isPrivate,
  isVerified: user.isVerified,
});

/** Creates and persists a new access + refresh token pair for the given user. */
const issueTokens = async (user: InstanceType<typeof User>): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = generateToken(user._id as Types.ObjectId);
  const rawRefreshToken = generateRefreshToken();
  const hashedRefreshToken = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ token: hashedRefreshToken, user: user._id, expiresAt });
  return { accessToken, refreshToken: rawRefreshToken };
};

/**
 * Registers a new user, sends a verification email (non-fatal on failure),
 * and returns tokens + a safe user object.
 */
export const register = async (data: {
  username: string; email: string; password: string; fullName?: string;
}): Promise<AuthResult> => {
  const existingEmail = await User.findOne({ email: data.email });
  if (existingEmail) throw new AppError('Email already in use', 409);

  const existingUsername = await User.findOne({ username: data.username });
  if (existingUsername) throw new AppError('Username already taken', 409);

  const user = await User.create(data);

  const { resetToken: verifyToken, hash } = generateResetToken();
  user.verifyEmailToken = hash;
  user.verifyEmailExpire = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verifyToken}`;
  try {
    await sendVerificationEmail(user.email, verifyUrl);
  } catch (err) {
    user.verifyEmailToken = undefined;
    user.verifyEmailExpire = undefined;
    await user.save({ validateBeforeSave: false });
    logger.error(`[Mail] Failed to send verification email to ${user.email}: ${(err as Error).message}`);
  }

  const { accessToken, refreshToken } = await issueTokens(user);
  return { accessToken, refreshToken, user: safeUser(user) };
};

/** Authenticates a user by email and password; throws 401 on any mismatch. */
export const login = async (data: { email: string; password: string }): Promise<AuthResult> => {
  const user = await User.findOne({ email: data.email }).select('+password');
  if (!user || !(await user.matchPassword(data.password))) {
    throw new AppError('Invalid email or password', 401);
  }
  const { accessToken, refreshToken } = await issueTokens(user);
  return { accessToken, refreshToken, user: safeUser(user) };
};

/** Rotates a valid refresh token — old token is deleted, a new pair is issued. */
export const refresh = async (rawRefreshToken: string): Promise<AuthResult> => {
  if (!rawRefreshToken) throw new AppError('Refresh token required', 400);
  const hashed = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ token: hashed, expiresAt: { $gt: new Date() } });
  if (!stored) throw new AppError('Invalid or expired refresh token', 401);
  const user = await User.findById(stored.user);
  if (!user) throw new AppError('User not found', 404);
  await RefreshToken.deleteOne({ _id: stored._id });
  const { accessToken, refreshToken: newRefreshToken } = await issueTokens(user);
  return { accessToken, refreshToken: newRefreshToken, user: safeUser(user) };
};

/** Removes the single refresh token record matching the raw token + userId pair. */
export const logout = async (rawRefreshToken: string | undefined, userId: Types.ObjectId): Promise<void> => {
  if (!rawRefreshToken) return;
  const hashed = hashToken(rawRefreshToken);
  await RefreshToken.deleteOne({ token: hashed, user: userId });
};

/** Deletes every refresh token for the given user, ending all active sessions. */
export const logoutAll = async (userId: Types.ObjectId): Promise<void> => {
  await RefreshToken.deleteMany({ user: userId });
};

/**
 * Generates a password-reset token, stores its hash, and sends the reset URL
 * by email. Returns silently if no account exists for the address (avoids enumeration).
 */
export const forgotPassword = async (email: string): Promise<void> => {
  const user = await User.findOne({ email });
  if (!user) return;

  const { resetToken, hash } = generateResetToken();
  user.resetPasswordToken = hash;
  user.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
  try {
    await sendPasswordReset(user.email, resetUrl);
  } catch {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    throw new AppError('Email could not be sent. Please try again later.', 500);
  }
};

/** Sets a new password after verifying the reset token; revokes all active sessions. */
export const resetPassword = async (resetToken: string, newPassword: string): Promise<string> => {
  const hash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hash,
    resetPasswordExpire: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpire');
  if (!user) throw new AppError('Invalid or expired reset token', 400);
  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  await RefreshToken.deleteMany({ user: user._id });
  return generateToken(user._id as Types.ObjectId);
};

/** Marks the user's email as verified by validating the hashed token. */
export const verifyEmail = async (token: string): Promise<void> => {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    verifyEmailToken: hash,
    verifyEmailExpire: { $gt: Date.now() },
  }).select('+verifyEmailToken +verifyEmailExpire');
  if (!user) throw new AppError('Invalid or expired verification token', 400);
  user.isVerified = true;
  user.verifyEmailToken = undefined;
  user.verifyEmailExpire = undefined;
  await user.save({ validateBeforeSave: false });
};

/** Re-generates and sends a fresh email verification link; throws if already verified. */
export const resendVerification = async (userId: Types.ObjectId): Promise<void> => {
  const user = await User.findById(userId).select('+verifyEmailToken +verifyEmailExpire');
  if (!user) throw new AppError('User not found', 404);
  if (user.isVerified) throw new AppError('Email is already verified', 400);
  const { resetToken: verifyToken, hash } = generateResetToken();
  user.verifyEmailToken = hash;
  user.verifyEmailExpire = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verifyToken}`;
  await sendVerificationEmail(user.email, verifyUrl);
};
