import { Response, NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AuthRequest } from '../types/index.js';
import { AppError } from '../utils/errors.js';

/**
 * Express middleware that verifies the Bearer JWT from the Authorization header
 * and attaches the authenticated user to `req.user`. Returns 401 on missing,
 * expired, or invalid tokens.
 */
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return next(new AppError('Not authorized, no token', 401));
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new AppError('User not found', 404));
    (req as AuthRequest).user = user;
    next();
  } catch (error) {
    if ((error as Error).name === 'TokenExpiredError') {
      return next(new AppError('Token expired', 401));
    }
    next(new AppError('Not authorized, token failed', 401));
  }
};
