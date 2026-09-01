import mongoose, { Schema } from "mongoose";
import { IRefreshToken } from "../types/index.js";

const refreshTokenSchema = new Schema<IRefreshToken>({
  token: { type: String, required: true, index: true },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IRefreshToken>(
  "RefreshToken",
  refreshTokenSchema,
);
