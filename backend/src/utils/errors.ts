/**
 * Operational error class for expected runtime failures (validation errors,
 * not-found, unauthorised, etc.). The `isOperational` flag tells the central
 * error handler to surface the message directly rather than replacing it with a
 * generic fallback.
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
