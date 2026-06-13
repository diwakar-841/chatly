import mongoose, { Schema } from 'mongoose';
import { IChat } from '../types/index.js';

const chatSchema = new Schema<IChat>(
  {
    name: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    isGroup: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: false },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    groupAvatar: { type: String, default: '' },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    pinnedMessages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    joinRequests: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    pendingInvites: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    hiddenBy: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
    unreadCounts: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

chatSchema.index({ members: 1, updatedAt: -1 });
chatSchema.index({ members: 1, isGroup: 1 });
chatSchema.index({ pendingInvites: 1 });

export default mongoose.model<IChat>('Chat', chatSchema);
