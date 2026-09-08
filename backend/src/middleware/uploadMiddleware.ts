import multer, { FileFilterCallback, MulterError } from "multer";
import type { Request, Response, NextFunction } from "express";
import { uploadToCloudinary } from "../config/cloudinary.js";
import { AppError } from "../utils/errors.js";
import logger from "../utils/logger.js";

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_MEDIA_SIZE = 25 * 1024 * 1024;

const INVALID_IMAGE_TYPE = "invalid_image_type";

const memoryStorage = multer.memoryStorage();

function toUploadAppError(err: unknown, maxSize: number): AppError {
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const maxMb = Math.round(maxSize / (1024 * 1024));
      return new AppError(`File is too large. Maximum size is ${maxMb}MB.`, 400);
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return new AppError("Unexpected file upload field.", 400);
    }
    return new AppError("The file could not be uploaded. Please try again.", 400);
  }
  if (err instanceof Error && err.message === INVALID_IMAGE_TYPE) {
    return new AppError("Only image files are allowed (jpg, png, gif, webp).", 400);
  }
  logger.error(`[Upload] Unexpected upload error: ${(err as Error)?.message ?? err}`);
  return new AppError("The file could not be uploaded. Please try again.", 400);
}

const imageMulter = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(INVALID_IMAGE_TYPE));
    }
  },
});

const mediaMulter = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_MEDIA_SIZE },
  fileFilter: (
    _req: Request,
    _file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    cb(null, true);
  },
});

function makeImageUpload(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    imageMulter.single(field)(req, res, async (err) => {
      if (err) {
        return next(toUploadAppError(err, MAX_IMAGE_SIZE));
      }
      if (!req.file) {
        return next();
      }
      try {
        const url = await uploadToCloudinary(req.file.buffer, {
          folder: "chat-app/avatars",
          resource_type: "image",
          transformation: [
            { width: 400, height: 400, crop: "fill", quality: "auto" },
          ],
        });
        req.file.path = url;
        next();
      } catch (uploadErr) {
        logger.error(
          `[Upload] Cloudinary avatar upload failed: ${(uploadErr as Error)?.message}`,
        );
        next(new AppError("The image could not be uploaded. Please try again.", 502));
      }
    });
  };
}

function makeMediaUpload(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    mediaMulter.single(field)(req, res, async (err) => {
      if (err) {
        return next(toUploadAppError(err, MAX_MEDIA_SIZE));
      }
      if (!req.file) {
        return next();
      }
      try {
        const url = await uploadToCloudinary(req.file.buffer, {
          folder: "chat-app/media",
          resource_type: "auto",
        });
        req.file.path = url;
        next();
      } catch (uploadErr) {
        logger.error(
          `[Upload] Cloudinary media upload failed: ${(uploadErr as Error)?.message}`,
        );
        next(new AppError("The file could not be uploaded. Please try again.", 502));
      }
    });
  };
}

export const imageUpload = { single: makeImageUpload };
export const mediaUpload = { single: makeMediaUpload };
export default imageUpload;
