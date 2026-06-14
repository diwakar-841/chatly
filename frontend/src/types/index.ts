/** Authenticated user returned from the API. */
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
  /** Friendship status relative to the requesting user (e.g. "none", "accepted"). */
  friendStatus?: string;
}

/** Payload returned by login and register endpoints. */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** A single emoji reaction on a message. */
export interface Reaction {
  user: string;
  emoji: string;
}

/** A chat message with optional media, reply reference, and reactions. */
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
  deliveredTo?: string[];
  deleted?: boolean;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A DM or group chat with members, admins, and optional invite/request queues. */
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
  joinRequests?: string[];
  pendingInvites?: string[];
  lastMessage?: Pick<Message, "_id" | "content" | "type" | "createdAt"> | null;
  pinnedMessages?: string[];
  unreadCount?: number;
  updatedAt: string;
  createdAt: string;
}

/** Lightweight group shape returned by the group search endpoint. */
export interface GroupResult {
  _id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  groupAvatar?: string;
  memberCount: number;
  isMember: boolean;
  hasRequested: boolean;
  isInvited: boolean;
}

/** A friend request with fully populated sender and recipient. */
export interface FriendRequest {
  _id: string;
  sender: User;
  recipient: User;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

/** All possible friendship states between the current user and another user. */
export type RequestStatus = "none" | "pending_sent" | "pending_received" | "accepted" | "blocked";

/** An in-app notification record. */
export interface Notification {
  _id: string;
  recipient: string;
  type: "request" | "request_accepted" | "message" | "group_add" | "group_invite" | "group_join_request" | "system";
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

/** Generic paginated response wrapper used by list endpoints. */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  hasMore: boolean;
}
