import { v2 as cloudinary } from "cloudinary";
import logger from "../utils/logger.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

logger.info("Cloudinary configured successfully");

export interface UploadOptions {
  folder: string;
  resource_type?: "image" | "video" | "raw" | "auto";
  transformation?: object[];
}


export function uploadToCloudinary(
  buffer: Buffer,
  options: UploadOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resource_type ?? "auto",
        transformation: options.transformation,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
        } else {
          resolve(result.secure_url);
        }
      },
    );
    stream.end(buffer);
  });
}

export default cloudinary;
