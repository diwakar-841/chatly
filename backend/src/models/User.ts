import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types/index.js';

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    avatar: { type: String, default: '' },
    bio: { type: String, maxlength: 200, default: '' },
    fullName: { type: String, trim: true, default: '' },
    isPrivate: { type: Boolean, default: true },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: false },
    verifyEmailToken: { type: String, select: false },
    verifyEmailExpire: { type: Date, select: false },
    education: [
      {
        school: String,
        degree: String,
        field: String,
        from: Date,
        to: Date,
        current: { type: Boolean, default: false },
      },
    ],
    experience: [
      {
        title: String,
        company: String,
        location: String,
        from: Date,
        to: Date,
        current: { type: Boolean, default: false },
        description: String,
      },
    ],
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
    /** NaCl Curve25519 public key (base64) for E2E encryption. Registered by the client on login. */
    publicKey: { type: String, default: '' },
  },
  { timestamps: true }
);

/** Hashes the password with bcrypt before saving if it was modified. */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/** Compares a plaintext password against the stored bcrypt hash. */
userSchema.methods.matchPassword = function (enteredPassword: string): Promise<boolean> {
  return bcrypt.compare(enteredPassword, this.password as string);
};

export default mongoose.model<IUser>('User', userSchema);
