import mongoose, { Schema } from 'mongoose';
import { IRequest } from '../types/index.js';

const requestSchema = new Schema<IRequest>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

/** Compound unique index prevents duplicate friend requests between the same two users. */
requestSchema.index({ sender: 1, recipient: 1 }, { unique: true });

export default mongoose.model<IRequest>('Request', requestSchema);
