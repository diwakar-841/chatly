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
 * generic message to avoid leaking internals in production.
 */
export const errorHandler = (
  err: AppError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = (err as AppError).statusCode ?? 500;
  const isOperational = (err as AppError).isOperational ?? false;

  if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${err.message}${err.stack ? `\n${err.stack}` : ''}`);
  } else {
    logger.warn(`[${statusCode}] ${err.message}`);
  }

  res.status(statusCode).json({
    message: isOperational ? err.message : 'An unexpected error occurred',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
