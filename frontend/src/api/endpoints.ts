import { api } from "./client";
import type {
  AuthResult, User, Chat, Message, FriendRequest, Notification, PaginatedResult, RequestStatus, GroupResult,
} from "@/types";

/** Authentication endpoints — register, login, token management, and email verification. */
export const authApi = {
  register: (data: { username: string; email: string; password: string; fullName?: string }) =>
    api.post<AuthResult>("/auth/register", data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResult>("/auth/login", data).then((r) => r.data),
  logout: (refreshToken?: string) => api.post("/auth/logout", { refreshToken }).then((r) => r.data),
  logoutAll: () => api.post("/auth/logout-all").then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
  forgot: (email: string) => api.post("/auth/forgot-password", { email }).then((r) => r.data),
  reset: (token: string, password: string) =>
    api.post(`/auth/reset-password/${token}`, { password }).then((r) => r.data),
  verifyEmail: (token: string) =>
    api.get(`/auth/verify-email/${token}`).then((r) => r.data),
  resendVerification: () =>
    api.post("/auth/resend-verification").then((r) => r.data),
};

/** User profile and search endpoints. */
export const profileApi = {
  get: (userId: string) => api.get<User>(`/profile/${userId}`).then((r) => r.data),
  update: (data: Partial<User>) => api.put<User>("/profile/me", data).then((r) => r.data),
  updateAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.put<User>("/profile/avatar", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
  search: (q: string, page = 1) =>
    api.get<PaginatedResult<User>>("/profile/search", { params: { q, page } }).then((r) => r.data),
  requestStatus: (userId: string) =>
    api.get<{ status: RequestStatus; requestId?: string }>(`/requests/status/${userId}`).then((r) => r.data),
};

/** Chat endpoints — DMs, groups, members, invites, join requests, and pinning. */
export const chatApi = {
  list: (page = 1) => api.get<Chat[]>("/chats", { params: { page } }).then((r) => r.data),
  get: (chatId: string) => api.get<Chat>(`/chats/${chatId}`).then((r) => r.data),
  dm: (userId: string) => api.get<Chat>(`/chats/dm/${userId}`).then((r) => r.data),
  createGroup: (data: { name: string; description?: string; isPublic?: boolean; members: string[]; file?: File }) => {
    const fd = new FormData();
    fd.append("name", data.name);
    if (data.description) fd.append("description", data.description);
    if (data.isPublic !== undefined) fd.append("isPublic", String(data.isPublic));
    data.members.forEach((m) => fd.append("members", m));
    if (data.file) fd.append("file", data.file);
    return api.post<Chat>("/chats/group", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
  searchGroups: (q: string, page = 1) =>
    api.get<PaginatedResult<GroupResult>>("/chats/search", { params: { q, page } }).then((r) => r.data),
  update: (chatId: string, data: { name?: string; file?: File }) => {
    const fd = new FormData();
    if (data.name) fd.append("name", data.name);
    if (data.file) fd.append("file", data.file);
    return api.put<Chat>(`/chats/${chatId}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
  addMembers: (chatId: string, members: string[]) =>
    api.post<Chat>(`/chats/${chatId}/members`, { members }).then((r) => r.data),
  removeMember: (chatId: string, memberId: string) =>
    api.delete<Chat>(`/chats/${chatId}/members/${memberId}`).then((r) => r.data),
  leave: (chatId: string) =>
    api.post(`/chats/${chatId}/leave`).then((r) => r.data),
  messages: (chatId: string, page = 1) =>
    api.get<PaginatedResult<Message>>(`/chats/${chatId}/messages`, { params: { page } }).then((r) => r.data),
  pinMessage: (chatId: string, messageId: string) =>
    api.patch<Chat>(`/chats/${chatId}/pin/${messageId}`).then((r) => r.data),
  requestJoin: (chatId: string) =>
    api.post(`/chats/${chatId}/join-request`).then((r) => r.data),
  getJoinRequests: (chatId: string) =>
    api.get<Chat>(`/chats/${chatId}/join-requests`).then((r) => r.data),
  handleJoinRequest: (chatId: string, userId: string, action: "accept" | "reject") =>
    api.post<Chat>(`/chats/${chatId}/join-requests/${userId}`, { action }).then((r) => r.data),
  hide: (chatId: string) =>
    api.delete(`/chats/${chatId}/hide`).then((r) => r.data),
  getMyInvites: () =>
    api.get<Chat[]>("/chats/invites").then((r) => r.data),
  acceptInvite: (chatId: string) =>
    api.post(`/chats/${chatId}/invite/accept`).then((r) => r.data),
  rejectInvite: (chatId: string) =>
    api.post(`/chats/${chatId}/invite/reject`).then((r) => r.data),
};

/** Message endpoints — send, delete, react, mark read, and clear chat. */
export const messageApi = {
  send: (data: { chatId: string; content?: string; type?: "text" | "image" | "file"; replyTo?: string; file?: File }) => {
    const fd = new FormData();
    fd.append("chatId", data.chatId);
    if (data.content) fd.append("content", data.content);
    if (data.type) fd.append("type", data.type);
    if (data.replyTo) fd.append("replyTo", data.replyTo);
    if (data.file) fd.append("file", data.file);
    return api.post<Message>("/messages", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
  delete: (messageId: string) => api.delete(`/messages/${messageId}`).then((r) => r.data),
  react: (messageId: string, emoji: string) =>
    api.post<Message>(`/messages/${messageId}/react`, { emoji }).then((r) => r.data),
  markRead: (chatId: string) => api.put(`/messages/read/${chatId}`).then((r) => r.data),
  clearChat: (chatId: string, forBoth: boolean) =>
    api.delete(`/messages/chat/${chatId}`, { params: { forBoth } }).then((r) => r.data),
};

/** Friend request endpoints — send, respond, withdraw, unfriend, and status check. */
export const requestApi = {
  send: (userId: string) => api.post<FriendRequest>(`/requests/send/${userId}`).then((r) => r.data),
  respond: (requestId: string, action: "accept" | "reject") =>
    api.put<FriendRequest>(`/requests/respond/${requestId}`, { action }).then((r) => r.data),
  pending: () => api.get<FriendRequest[]>("/requests/pending").then((r) => r.data),
  sent: () => api.get<FriendRequest[]>("/requests/sent").then((r) => r.data),
  withdraw: (requestId: string) =>
    api.delete(`/requests/withdraw/${requestId}`).then((r) => r.data),
  unfriend: (userId: string) =>
    api.delete(`/requests/unfriend/${userId}`).then((r) => r.data),
};

/** Block endpoints — block, unblock, list, and bidirectional status check. */
export const blockApi = {
  block: (userId: string) => api.post(`/block/${userId}`).then((r) => r.data),
  unblock: (userId: string) => api.delete(`/block/${userId}`).then((r) => r.data),
  list: () => api.get<User[]>("/block").then((r) => r.data),
  checkBlock: (userId: string) =>
    api.get<{ blockedByMe: boolean; blockedByThem: boolean }>(`/block/check/${userId}`).then((r) => r.data),
};

/** Notification endpoints — list, mark read, count unread, and delete. */
export const notificationApi = {
  list: () => api.get<Notification[]>("/notifications").then((r) => r.data),
  unreadCount: () => api.get<{ count: number }>("/notifications/unread-count").then((r) => r.data),
  markAllRead: () => api.put("/notifications/read-all").then((r) => r.data),
  markOneRead: (id: string) => api.put(`/notifications/read/${id}`).then((r) => r.data),
  deleteOne: (id: string) => api.delete(`/notifications/${id}`).then((r) => r.data),
  clearAll: () => api.delete("/notifications/clear-all").then((r) => r.data),
};

/** AI chat endpoint — sends a message with conversation history to the Gemini proxy. */
export const aiApi = {
  chat: (message: string, history: { role: "user" | "model"; parts: { text: string }[] }[]) =>
    api.post<{ reply: string }>("/ai/chat", { message, history }).then((r) => r.data),
};
