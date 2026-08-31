import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService.js';
import { AuthRequest } from '../types/index.js';

/** Creates a new user account and sends a verification email. */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.register(req.body as { username: string; email: string; password: string; fullName?: string });
    res.status(201).json(result);
  } catch (err) { next(err); }
};

/** Authenticates a user by email/password and returns access + refresh tokens. */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.login(req.body as { email: string; password: string });
    res.json(result);
  } catch (err) { next(err); }
};

/** Exchanges a valid refresh token for a new access + refresh token pair. */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = (req.body as { refreshToken: string }).refreshToken;
    const result = await authService.refresh(token);
    res.json(result);
  } catch (err) { next(err); }
};

/** Invalidates the supplied refresh token for the current device. */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken: token } = req.body as { refreshToken?: string };
    await authService.logout(token, (req as AuthRequest).user._id);
    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
};

/** Revokes all refresh tokens for the current user across every device. */
export const logoutAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await authService.logoutAll((req as AuthRequest).user._id);
    res.json({ message: 'Logged out from all devices' });
  } catch (err) { next(err); }
};

/** Sends a password-reset email if the address belongs to an existing account. */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await authService.forgotPassword((req.body as { email: string }).email);
    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (err) { next(err); }
};

/** Validates the emailed OTP and sets a new password, returning a fresh access token. */
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp, password } = req.body as { email: string; otp: string; password: string };
    const accessToken = await authService.resetPassword(email, otp, password);
    res.json({ accessToken });
  } catch (err) { next(err); }
};

/** Marks the user's email as verified using the OTP code sent by email. */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp } = req.body as { email: string; otp: string };
    await authService.verifyEmail(email, otp);
    res.json({ message: 'Email verified successfully' });
  } catch (err) { next(err); }
};

/** Re-sends the email verification OTP to the current user's address. */
export const resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await authService.resendVerification((req as AuthRequest).user._id);
    res.json({ message: 'Verification email sent' });
  } catch (err) { next(err); }
};

/** Returns the currently authenticated user object. */
export const getMe = (req: Request, res: Response): void => {
  res.json((req as AuthRequest).user);
};
