import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.js";
import { AppError } from "../utils/errors.js";

export const notFound = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  next(new AppError(`Not Found - ${req.originalUrl}`, 404));
};

export const errorHandler = (
  err: AppError | Error | any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode = (err as AppError).statusCode ?? err?.statusCode ?? 500;
  let isOperational =
    (err as AppError).isOperational ?? err?.isOperational ?? false;

  
  if (err?.code === 11000 && !isOperational) {
    const field = err?.keyValue ? Object.keys(err.keyValue)[0] : "field";
    err.message = `That ${field} is already in use.`;
    statusCode = 409;
    isOperational = true;
  }

  
  if (err?.name === "CastError" && !isOperational) {
    err.message = "Invalid identifier supplied.";
    statusCode = 400;
    isOperational = true;
  }

  
  if (statusCode >= 500) {
    logger.error(
      `[${statusCode}] ${err.message}${err.stack ? `\n${err.stack}` : ""}`,
    );
  } else {
    logger.warn(
      `[${statusCode}] ${err.message}${err?.details ? ` - ${JSON.stringify(err.details)}` : ""}`,
    );
  }

  
  const body: { message: string; errors?: { param?: string; msg: string }[] } =
    {
      message: isOperational
        ? String(err.message)
        : "Something went wrong. Please try again later.",
    };

  
  
  if (isOperational && err?.errors && Array.isArray(err.errors)) {
    const validationErrors = err.errors.map((e: any) => {
      return { param: e.path ?? e.param, msg: e.msg };
    });
    body.errors = validationErrors;
    if (validationErrors.length > 0) {
      body.message = validationErrors[0].msg;
    }
  }

  res.status(statusCode).json(body);
};
