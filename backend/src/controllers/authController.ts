import { Request, Response, NextFunction } from "express";
import * as authService from "../services/authService.js";
import { AuthRequest } from "../types/index.js";


export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await authService.register(
      req.body as {
        username: string;
        email: string;
        password: string;
        fullName?: string;
      },
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};


export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await authService.login(
      req.body as { email: string; password: string },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};


export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = (req.body as { refreshToken: string }).refreshToken;
    const result = await authService.refresh(token);
    res.json(result);
  } catch (err) {
    next(err);
  }
};


export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { refreshToken: token } = req.body as { refreshToken?: string };
    await authService.logout(token, (req as AuthRequest).user._id);
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
};


export const logoutAll = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await authService.logoutAll((req as AuthRequest).user._id);
    res.json({ message: "Logged out from all devices" });
  } catch (err) {
    next(err);
  }
};


export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await authService.forgotPassword((req.body as { email: string }).email);
    res.json({
      message:
        "If an account with that email exists, a reset link has been sent.",
    });
  } catch (err) {
    next(err);
  }
};


export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, otp, password } = req.body as {
      email: string;
      otp: string;
      password: string;
    };
    const accessToken = await authService.resetPassword(email, otp, password);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
};


export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, otp } = req.body as { email: string; otp: string };
    await authService.verifyEmail(email, otp);
    res.json({ message: "Email verified successfully" });
  } catch (err) {
    next(err);
  }
};


export const resendVerification = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await authService.resendVerification((req as AuthRequest).user._id);
    res.json({ message: "Verification email sent" });
  } catch (err) {
    next(err);
  }
};


export const getMe = (req: Request, res: Response): void => {
  res.json((req as AuthRequest).user);
};
