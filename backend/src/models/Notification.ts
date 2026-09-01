import mongoose, { Schema } from "mongoose";
import { INotification } from "../types/index.js";

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User" },
    type: {
      type: String,
      enum: [
        "message",
        "request",
        "request_accepted",
        "group_add",
        "system",
        "group_join_request",
        "group_invite",
      ],
      required: true,
    },
    message: { type: String, default: "" },
    isRead: { type: Boolean, default: false },
    link: { type: String, default: "" },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

export default mongoose.model<INotification>(
  "Notification",
  notificationSchema,
);
