import mongoose, { Schema } from 'mongoose';
import { IBlockedUser } from '../types/index.js';

const blockedUserSchema = new Schema<IBlockedUser>(
  {
    blocker: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blocked: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

/** Compound unique index prevents duplicate block records in either direction. */
blockedUserSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

export default mongoose.model<IBlockedUser>('BlockedUser', blockedUserSchema);
