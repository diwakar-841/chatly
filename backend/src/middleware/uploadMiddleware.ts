import multer, { FileFilterCallback } from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { uploadToCloudinary } from '../config/cloudinary.js';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_MEDIA_SIZE = 25 * 1024 * 1024;

const memoryStorage = multer.memoryStorage();

const imageMulter = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (IMAGE_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed (jpg, png, gif, webp)'));
  },
});

const mediaMulter = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_MEDIA_SIZE },
  fileFilter: (_req: Request, _file: Express.Multer.File, cb: FileFilterCallback) => {
    cb(null, true);
  },
});

/**
 * Returns an Express middleware that accepts a single image field, uploads it
 * to Cloudinary with avatar crop/quality transforms, and stores the resulting
 * URL in `req.file.path`.
 */
function makeImageUpload(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    imageMulter.single(field)(req, res, async (err) => {
      if (err) return next(err);
      if (!req.file) return next();
      try {
        const url = await uploadToCloudinary(req.file.buffer, {
          folder: 'chat-app/avatars',
          resource_type: 'image',
          transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
        });
        req.file.path = url;
        next();
      } catch (uploadErr) {
        next(uploadErr);
      }
    });
  };
}

/**
 * Returns an Express middleware that accepts any single file field, uploads it
 * to Cloudinary (auto resource type), and stores the URL in `req.file.path`.
 */
function makeMediaUpload(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    mediaMulter.single(field)(req, res, async (err) => {
      if (err) return next(err);
      if (!req.file) return next();
      try {
        const url = await uploadToCloudinary(req.file.buffer, {
          folder: 'chat-app/media',
          resource_type: 'auto',
        });
        req.file.path = url;
        next();
      } catch (uploadErr) {
        next(uploadErr);
      }
    });
  };
}

export const imageUpload = { single: makeImageUpload };
export const mediaUpload = { single: makeMediaUpload };
export default imageUpload;
