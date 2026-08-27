import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/** Falls through to the error handler for any unmatched route. */
export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  next(new AppError(`Not Found - ${req.originalUrl}`, 404));
};

/**
 * Central Express error handler. 4xx client errors are logged as warnings;
 * 5xx server errors are logged as errors. Non-operational errors return a
 * generic message to avoid leaking internals in production. The response
 * shape is kept stable: { message: string, errors?: Array<{ param?: string, msg: string }> }
 */
export const errorHandler = (
  err: AppError | Error | any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = (err as AppError).statusCode ?? err?.statusCode ?? 500;
  const isOperational = (err as AppError).isOperational ?? err?.isOperational ?? false;

  // Log full details server-side for debugging.
  if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${err.message}${err.stack ? `\n${err.stack}` : ''}`);
  } else {
    logger.warn(`[${statusCode}] ${err.message}${err?.details ? ` - ${JSON.stringify(err.details)}` : ''}`);
  }

  // Build a stable, safe response body.
  const body: { message: string; errors?: { param?: string; msg: string }[] } = {
    message: isOperational ? String(err.message) : 'An unexpected error occurred',
  };

  // If the error contains validation details (e.g. express-validator), surface them safely.
  if (err?.errors && Array.isArray(err.errors)) {
    body.errors = err.errors.map((e: any) => ({ param: e.param, msg: e.msg }));
    // Prefer the first validation message as the top-level message if available.
    if (body.errors.length > 0) body.message = body.errors[0].msg;
  }

  res.status(statusCode).json(body);
};
