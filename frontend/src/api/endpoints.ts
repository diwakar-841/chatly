import { api } from "./client";
import type {
  AuthResult,
  User,
  Chat,
  Message,
  FriendRequest,
  Notification,
  PaginatedResult,
  RequestStatus,
  GroupResult,
} from "@/types";

export const authApi = {
  register: (data: { username: string; email: string; password: string; fullName?: string }) => {
    return api.post<AuthResult>("/auth/register", data).then(r => {
      return r.data;
    });
  },
  login: (data: { email: string; password: string }) => {
    return api.post<AuthResult>("/auth/login", data).then(r => {
      return r.data;
    });
  },
  logout: (refreshToken?: string) => {
    return api.post("/auth/logout", { refreshToken }).then(r => {
      return r.data;
    });
  },
  logoutAll: () => {
    return api.post("/auth/logout-all").then(r => {
      return r.data;
    });
  },
  me: () => {
    return api.get<User>("/auth/me").then(r => {
      return r.data;
    });
  },
  forgot: (email: string) => {
    return api.post("/auth/forgot-password", { email }).then(r => {
      return r.data;
    });
  },
  reset: (email: string, otp: string, password: string) => {
    return api.post("/auth/reset-password", { email, otp, password }).then(r => {
      return r.data;
    });
  },
  verifyEmail: (email: string, otp: string) => {
    return api.post("/auth/verify-email", { email, otp }).then(r => {
      return r.data;
    });
  },
  resendVerification: () => {
    return api.post("/auth/resend-verification").then(r => {
      return r.data;
    });
  },
  
  setPublicKey: (publicKey: string) => {
    return api.put("/auth/public-key", { publicKey }).then(r => {
      return r.data;
    });
  },
  
  getPublicKey: (userId: string) => {
    return api.get<{ publicKey: string }>(`/auth/public-key/${userId}`).then(r => {
      return r.data;
    });
  },
};

export const profileApi = {
  get: (userId: string) => {
    return api.get<User>(`/profile/${userId}`).then(r => {
      return r.data;
    });
  },
  update: (data: Partial<User>) => {
    return api.put<User>("/profile/me", data).then(r => {
      return r.data;
    });
  },
  updateAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .put<User>("/profile/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } })
      .then(r => {
        return r.data;
      });
  },
  search: (q: string, page = 1) => {
    return api.get<PaginatedResult<User>>("/profile/search", { params: { q, page } }).then(r => {
      return r.data;
    });
  },
  requestStatus: (userId: string) => {
    return api
      .get<{ status: RequestStatus; requestId?: string }>(`/requests/status/${userId}`)
      .then(r => {
        return r.data;
      });
  },
};

export const chatApi = {
  list: (page = 1) => {
    return api.get<Chat[]>("/chats", { params: { page } }).then(r => {
      return r.data;
    });
  },
  get: (chatId: string) => {
    return api.get<Chat>(`/chats/${chatId}`).then(r => {
      return r.data;
    });
  },
  dm: (userId: string) => {
    return api.get<Chat>(`/chats/dm/${userId}`).then(r => {
      return r.data;
    });
  },
  createGroup: (data: {
    name: string;
    description?: string;
    isPublic?: boolean;
    members: string[];
    file?: File;
  }) => {
    const fd = new FormData();
    fd.append("name", data.name);
    if (data.description) {
      fd.append("description", data.description);
    }
    if (data.isPublic !== undefined) {
      fd.append("isPublic", String(data.isPublic));
    }
    data.members.forEach(m => {
      return fd.append("members", m);
    });
    if (data.file) {
      fd.append("file", data.file);
    }
    return api
      .post<Chat>("/chats/group", fd, { headers: { "Content-Type": "multipart/form-data" } })
      .then(r => {
        return r.data;
      });
  },
  searchGroups: (q: string, page = 1) => {
    return api
      .get<PaginatedResult<GroupResult>>("/chats/search", { params: { q, page } })
      .then(r => {
        return r.data;
      });
  },
  update: (chatId: string, data: { name?: string; file?: File }) => {
    const fd = new FormData();
    if (data.name) {
      fd.append("name", data.name);
    }
    if (data.file) {
      fd.append("file", data.file);
    }
    return api
      .put<Chat>(`/chats/${chatId}`, fd, { headers: { "Content-Type": "multipart/form-data" } })
      .then(r => {
        return r.data;
      });
  },
  addMembers: (chatId: string, members: string[]) => {
    return api.post<Chat>(`/chats/${chatId}/members`, { members }).then(r => {
      return r.data;
    });
  },
  removeMember: (chatId: string, memberId: string) => {
    return api.delete<Chat>(`/chats/${chatId}/members/${memberId}`).then(r => {
      return r.data;
    });
  },
  leave: (chatId: string) => {
    return api.post(`/chats/${chatId}/leave`).then(r => {
      return r.data;
    });
  },
  messages: (chatId: string, page = 1) => {
    return api
      .get<PaginatedResult<Message>>(`/chats/${chatId}/messages`, { params: { page } })
      .then(r => {
        return r.data;
      });
  },
  pinMessage: (chatId: string, messageId: string) => {
    return api.patch<Chat>(`/chats/${chatId}/pin/${messageId}`).then(r => {
      return r.data;
    });
  },
  requestJoin: (chatId: string) => {
    return api.post(`/chats/${chatId}/join-request`).then(r => {
      return r.data;
    });
  },
  getJoinRequests: (chatId: string) => {
    return api.get<Chat>(`/chats/${chatId}/join-requests`).then(r => {
      return r.data;
    });
  },
  handleJoinRequest: (chatId: string, userId: string, action: "accept" | "reject") => {
    return api.post<Chat>(`/chats/${chatId}/join-requests/${userId}`, { action }).then(r => {
      return r.data;
    });
  },
  hide: (chatId: string) => {
    return api.delete(`/chats/${chatId}/hide`).then(r => {
      return r.data;
    });
  },
  getMyInvites: () => {
    return api.get<Chat[]>("/chats/invites").then(r => {
      return r.data;
    });
  },
  acceptInvite: (chatId: string) => {
    return api.post(`/chats/${chatId}/invite/accept`).then(r => {
      return r.data;
    });
  },
  rejectInvite: (chatId: string) => {
    return api.post(`/chats/${chatId}/invite/reject`).then(r => {
      return r.data;
    });
  },
  
  setDisappearing: (chatId: string, seconds: number) => {
    return api.patch<Chat>(`/chats/${chatId}/disappearing`, { seconds }).then(r => {
      return r.data;
    });
  },
};

export const messageApi = {
  send: (data: {
    chatId: string;
    content?: string;
    type?: "text" | "image" | "file";
    replyTo?: string;
    file?: File;
    encryptedContent?: string;
    nonce?: string;
  }) => {
    const fd = new FormData();
    fd.append("chatId", data.chatId);
    if (data.content) {
      fd.append("content", data.content);
    }
    if (data.type) {
      fd.append("type", data.type);
    }
    if (data.replyTo) {
      fd.append("replyTo", data.replyTo);
    }
    if (data.file) {
      fd.append("file", data.file);
    }
    if (data.encryptedContent) {
      fd.append("encryptedContent", data.encryptedContent);
    }
    if (data.nonce) {
      fd.append("nonce", data.nonce);
    }
    return api
      .post<Message>("/messages", fd, { headers: { "Content-Type": "multipart/form-data" } })
      .then(r => {
        return r.data;
      });
  },
  
  edit: (
    messageId: string,
    data: { content?: string; encryptedContent?: string; nonce?: string }
  ) => {
    return api.put<Message>(`/messages/${messageId}`, data).then(r => {
      return r.data;
    });
  },
  delete: (messageId: string) => {
    return api.delete(`/messages/${messageId}`).then(r => {
      return r.data;
    });
  },
  react: (messageId: string, emoji: string) => {
    return api.post<Message>(`/messages/${messageId}/react`, { emoji }).then(r => {
      return r.data;
    });
  },
  markRead: (chatId: string) => {
    return api.put(`/messages/read/${chatId}`).then(r => {
      return r.data;
    });
  },
  clearChat: (chatId: string, forBoth: boolean) => {
    return api.delete(`/messages/chat/${chatId}`, { params: { forBoth } }).then(r => {
      return r.data;
    });
  },
};

export const requestApi = {
  send: (userId: string) => {
    return api.post<FriendRequest>(`/requests/send/${userId}`).then(r => {
      return r.data;
    });
  },
  respond: (requestId: string, action: "accept" | "reject") => {
    return api.put<FriendRequest>(`/requests/respond/${requestId}`, { action }).then(r => {
      return r.data;
    });
  },
  pending: () => {
    return api.get<FriendRequest[]>("/requests/pending").then(r => {
      return r.data;
    });
  },
  sent: () => {
    return api.get<FriendRequest[]>("/requests/sent").then(r => {
      return r.data;
    });
  },
  withdraw: (requestId: string) => {
    return api.delete(`/requests/withdraw/${requestId}`).then(r => {
      return r.data;
    });
  },
  unfriend: (userId: string) => {
    return api.delete(`/requests/unfriend/${userId}`).then(r => {
      return r.data;
    });
  },
};

export const blockApi = {
  block: (userId: string) => {
    return api.post(`/block/${userId}`).then(r => {
      return r.data;
    });
  },
  unblock: (userId: string) => {
    return api.delete(`/block/${userId}`).then(r => {
      return r.data;
    });
  },
  list: () => {
    return api.get<User[]>("/block").then(r => {
      return r.data;
    });
  },
  checkBlock: (userId: string) => {
    return api
      .get<{ blockedByMe: boolean; blockedByThem: boolean }>(`/block/check/${userId}`)
      .then(r => {
        return r.data;
      });
  },
};

export const notificationApi = {
  list: () => {
    return api.get<Notification[]>("/notifications").then(r => {
      return r.data;
    });
  },
  unreadCount: () => {
    return api.get<{ count: number }>("/notifications/unread-count").then(r => {
      return r.data;
    });
  },
  markAllRead: () => {
    return api.put("/notifications/read-all").then(r => {
      return r.data;
    });
  },
  markOneRead: (id: string) => {
    return api.put(`/notifications/read/${id}`).then(r => {
      return r.data;
    });
  },
  deleteOne: (id: string) => {
    return api.delete(`/notifications/${id}`).then(r => {
      return r.data;
    });
  },
  clearAll: () => {
    return api.delete("/notifications/clear-all").then(r => {
      return r.data;
    });
  },
};

export const aiApi = {
  chat: (message: string, history: { role: "user" | "model"; parts: { text: string }[] }[]) => {
    return api.post<{ reply: string }>("/ai/chat", { message, history }).then(r => {
      return r.data;
    });
  },
};
