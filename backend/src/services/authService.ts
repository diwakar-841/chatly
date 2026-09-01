import crypto from "crypto";
import { Types } from "mongoose";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import {
  generateToken,
  generateRefreshToken,
  generateOtp,
} from "../utils/generateToken.js";
import { sendPasswordResetOtp, sendVerificationOtp } from "./emailService.js";
import { AppError } from "../utils/errors.js";
import { AuthResult, SafeUser } from "../types/index.js";
import logger from "../utils/logger.js";

const REFRESH_TOKEN_EXPIRE_DAYS = 30;

const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const safeUser = (user: InstanceType<typeof User>): SafeUser => {
  return {
    _id: user._id as Types.ObjectId,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    avatar: user.avatar,
    isPrivate: user.isPrivate,
    isVerified: user.isVerified,
  };
};

const issueTokens = async (
  user: InstanceType<typeof User>,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = generateToken(user._id as Types.ObjectId);
  const rawRefreshToken = generateRefreshToken();
  const hashedRefreshToken = hashToken(rawRefreshToken);
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000,
  );
  await RefreshToken.create({
    token: hashedRefreshToken,
    user: user._id,
    expiresAt,
  });
  return { accessToken, refreshToken: rawRefreshToken };
};

export const register = async (data: {
  username: string;
  email: string;
  password: string;
  fullName?: string;
}): Promise<AuthResult> => {
  const existingEmail = await User.findOne({ email: data.email });
  if (existingEmail) {
    throw new AppError("Email already in use", 409);
  }

  const existingUsername = await User.findOne({ username: data.username });
  if (existingUsername) {
    throw new AppError("Username already taken", 409);
  }

  const user = await User.create(data);

  const { otp, hash } = generateOtp();
  user.verifyEmailOtp = hash;
  user.verifyEmailOtpExpire = new Date(Date.now() + 10 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  try {
    await sendVerificationOtp(user.email, otp);
  } catch (err) {
    user.verifyEmailOtp = undefined;
    user.verifyEmailOtpExpire = undefined;
    await user.save({ validateBeforeSave: false });
    logger.error(
      `[Mail] Failed to send verification OTP to ${user.email}: ${(err as Error).message}`,
    );
  }

  const { accessToken, refreshToken } = await issueTokens(user);
  return { accessToken, refreshToken, user: safeUser(user) };
};

export const login = async (data: {
  email: string;
  password: string;
}): Promise<AuthResult> => {
  const user = await User.findOne({ email: data.email }).select("+password");
  if (!user || !(await user.matchPassword(data.password))) {
    throw new AppError("Invalid email or password", 401);
  }
  const { accessToken, refreshToken } = await issueTokens(user);
  return { accessToken, refreshToken, user: safeUser(user) };
};

export const refresh = async (rawRefreshToken: string): Promise<AuthResult> => {
  if (!rawRefreshToken) {
    throw new AppError("Refresh token required", 400);
  }
  const hashed = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({
    token: hashed,
    expiresAt: { $gt: new Date() },
  });
  if (!stored) {
    throw new AppError("Invalid or expired refresh token", 401);
  }
  const user = await User.findById(stored.user);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  await RefreshToken.deleteOne({ _id: stored._id });
  const { accessToken, refreshToken: newRefreshToken } =
    await issueTokens(user);
  return { accessToken, refreshToken: newRefreshToken, user: safeUser(user) };
};

export const logout = async (
  rawRefreshToken: string | undefined,
  userId: Types.ObjectId,
): Promise<void> => {
  if (!rawRefreshToken) {
    return;
  }
  const hashed = hashToken(rawRefreshToken);
  await RefreshToken.deleteOne({ token: hashed, user: userId });
};

export const logoutAll = async (userId: Types.ObjectId): Promise<void> => {
  await RefreshToken.deleteMany({ user: userId });
};

export const forgotPassword = async (email: string): Promise<void> => {
  const user = await User.findOne({ email });
  if (!user) {
    return;
  }

  const { otp, hash } = generateOtp();
  user.resetPasswordOtp = hash;
  user.resetPasswordOtpExpire = new Date(Date.now() + 10 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetOtp(user.email, otp);
  } catch {
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpire = undefined;
    await user.save({ validateBeforeSave: false });
    throw new AppError("Email could not be sent. Please try again later.", 500);
  }
};

export const resetPassword = async (
  email: string,
  otp: string,
  newPassword: string,
): Promise<string> => {
  const hash = crypto.createHash("sha256").update(otp).digest("hex");
  const user = await User.findOne({
    email,
    resetPasswordOtp: hash,
    resetPasswordOtpExpire: { $gt: Date.now() },
  }).select("+resetPasswordOtp +resetPasswordOtpExpire");
  if (!user) {
    throw new AppError("Invalid or expired OTP", 400);
  }
  user.password = newPassword;
  user.resetPasswordOtp = undefined;
  user.resetPasswordOtpExpire = undefined;
  await user.save();
  await RefreshToken.deleteMany({ user: user._id });
  return generateToken(user._id as Types.ObjectId);
};

export const verifyEmail = async (
  email: string,
  otp: string,
): Promise<void> => {
  const hash = crypto.createHash("sha256").update(otp).digest("hex");
  const user = await User.findOne({
    email,
    verifyEmailOtp: hash,
    verifyEmailOtpExpire: { $gt: Date.now() },
  }).select("+verifyEmailOtp +verifyEmailOtpExpire");
  if (!user) {
    throw new AppError("Invalid or expired OTP", 400);
  }
  user.isVerified = true;
  user.verifyEmailOtp = undefined;
  user.verifyEmailOtpExpire = undefined;
  await user.save({ validateBeforeSave: false });
};

export const resendVerification = async (
  userId: Types.ObjectId,
): Promise<void> => {
  const user = await User.findById(userId).select(
    "+verifyEmailOtp +verifyEmailOtpExpire",
  );
  if (!user) {
    throw new AppError("User not found", 404);
  }
  if (user.isVerified) {
    throw new AppError("Email is already verified", 400);
  }
  const { otp, hash } = generateOtp();
  user.verifyEmailOtp = hash;
  user.verifyEmailOtpExpire = new Date(Date.now() + 10 * 60 * 1000);
  await user.save({ validateBeforeSave: false });
  await sendVerificationOtp(user.email, otp);
};
