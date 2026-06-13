import { Request } from 'express';
import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  password: string;
  avatar: string;
  bio: string;
  fullName: string;
  isPrivate: boolean;
  isOnline: boolean;
  lastSeen: Date;
  isVerified: boolean;
  verifyEmailToken?: string;
  verifyEmailExpire?: Date;
  education: IEducation[];
  experience: IExperience[];
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  createdAt: Date;
  updatedAt: Date;
  matchPassword(enteredPassword: string): Promise<boolean>;
}

export interface IEducation {
  school: string;
  degree: string;
  field: string;
  from: Date;
  to?: Date;
  current: boolean;
}

export interface IExperience {
  title: string;
  company: string;
  location: string;
  from: Date;
  to?: Date;
  current: boolean;
  description?: string;
}

export interface IRefreshToken extends Document {
  token: string;
  user: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

export interface IMessage extends Document {
  _id: Types.ObjectId;
  chat: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'file';
  mediaUrl: string;
  reactions: IReaction[];
  readBy: Types.ObjectId[];
  replyTo: Types.ObjectId | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReaction {
  user: Types.ObjectId;
  emoji: string;
}

export interface IChat extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  isGroup: boolean;
  isPublic: boolean;
  members: Types.ObjectId[];
  admins: Types.ObjectId[];
  groupAvatar: string;
  lastMessage?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  pinnedMessages: Types.ObjectId[];
  joinRequests: Types.ObjectId[];
  hiddenBy: Types.ObjectId[];
  pendingInvites: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  sender?: Types.ObjectId;
  type: 'message' | 'request' | 'request_accepted' | 'group_add' | 'group_join_request' | 'group_invite' | 'system';
  message: string;
  isRead: boolean;
  link: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRequest extends Document {
  _id: Types.ObjectId;
  sender: Types.ObjectId;
  recipient: Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface IBlockedUser extends Document {
  _id: Types.ObjectId;
  blocker: Types.ObjectId;
  blocked: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeUser {
  _id: Types.ObjectId;
  username: string;
  email: string;
  fullName: string;
  avatar: string;
  isPrivate: boolean;
  isVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: SafeUser;
}

export interface AuthRequest extends Request {
  user: IUser;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  members: string[];
  creatorId: Types.ObjectId;
  groupAvatar?: string;
}

export interface SendMessageInput {
  chatId: string;
  content?: string;
  type?: 'text' | 'image' | 'file';
  replyTo?: string;
  mediaUrl?: string;
  senderId: Types.ObjectId;
  senderUsername: string;
}

export interface ProfileUpdates {
  fullName?: string;
  bio?: string;
  isPrivate?: boolean;
  education?: IEducation[];
  experience?: IExperience[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface User {
  _id: string;
  username: string;
  email: string;
  fullName?: string;
  avatar?: string;
  bio?: string;
  isPrivate?: boolean;
  isOnline?: boolean;
  isVerified?: boolean;
  lastSeen?: string;
  createdAt?: string;
  friendStatus?: string;
}

export interface Message {
  _id: string;
  chat: string;
  sender: User | string;
  content?: string;
  type: "text" | "image" | "file";
  mediaUrl?: string;
  replyTo?: Message | string | null;
  reactions?: Reaction[];
  readBy?: string[];
  deleted?: boolean;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Reaction {
  user: string;
  emoji: string;
}

export interface Chat {
  _id: string;
  isGroup: boolean;
  name?: string;
  description?: string;
  isPublic?: boolean;
  groupAvatar?: string;
  members: User[];
  admins?: string[];
  creator?: string;
  lastMessage?: Pick<Message, "_id" | "content" | "type" | "createdAt"> | null;
  pinnedMessages?: string[];
  joinRequests?: User[];
  unreadCount?: number;
  updatedAt: string;
  createdAt: string;
}
