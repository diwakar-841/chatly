import mongoose, { Schema } from 'mongoose';
import { IMessage } from '../types/index.js';

const reactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    emoji: String,
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    chat: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    mediaUrl: { type: String, default: '' },
    reactions: [reactionSchema],
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deliveredTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    isDeleted: { type: Boolean, default: false },
    /** Users listed here have performed "delete for me" — the message is hidden only for them. */
    deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    /** True when the sender has edited this message at least once. */
    isEdited: { type: Boolean, default: false },
    /** Timestamp of the last edit. */
    editedAt: { type: Date, default: null },
    /** Base64-encoded NaCl box ciphertext for E2E-encrypted DM messages. */
    encryptedContent: { type: String, default: '' },
    /** Base64-encoded 24-byte nonce paired with encryptedContent. */
    nonce: { type: String, default: '' },
  },
  { timestamps: true }
);

messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ chat: 1, isDeleted: 1, createdAt: -1 });

export default mongoose.model<IMessage>('Message', messageSchema);
