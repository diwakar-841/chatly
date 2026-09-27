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
  
  publicKey?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Reaction {
  user: string;
  emoji: string;
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
  deliveredTo?: string[];
  deleted?: boolean;
  isPinned?: boolean;
  
  isEdited?: boolean;
  
  editedAt?: string | null;
  
  encryptedContent?: string;
  
  nonce?: string;
  
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
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
  joinRequests?: string[];
  pendingInvites?: string[];
  lastMessage?: Pick<
    Message,
    "_id" | "content" | "encryptedContent" | "nonce" | "type" | "createdAt"
  > | null;
  pinnedMessages?: string[];
  unreadCount?: number;
  
  disappearingMessages?: number;
  updatedAt: string;
  createdAt: string;
}

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

export interface FriendRequest {
  _id: string;
  sender: User;
  recipient: User;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export type RequestStatus = "none" | "pending_sent" | "pending_received" | "accepted" | "blocked";

export interface Notification {
  _id: string;
  recipient: string;
  type:
    | "request"
    | "request_accepted"
    | "message"
    | "group_add"
    | "group_invite"
    | "group_join_request"
    | "system";
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  hasMore: boolean;
}
