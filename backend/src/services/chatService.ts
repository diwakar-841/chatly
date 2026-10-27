import { Types } from "mongoose";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import BlockedUser from "../models/BlockedUser.js";
import Request from "../models/Request.js";
import User from "../models/User.js";
import { AppError } from "../utils/errors.js";
import {
  MAX_GROUP_MEMBERS,
  CHATS_PAGE_LIMIT,
  MESSAGE_LIMIT,
} from "../utils/constants.js";
import {
  IChat,
  IMessage,
  CreateGroupInput,
  PaginatedResult,
} from "../types/index.js";
import Notification from "../models/Notification.js";
import { getIO } from "../config/socket.js";
import escapeRegex from "../utils/escapeRegex.js";
import logger from "../utils/logger.js";

export const getOrCreateDM = async (
  userId1: Types.ObjectId,
  userId2: string,
): Promise<IChat> => {
  if (userId1.toString() === userId2.toString()) {
    throw new AppError("You cannot start a chat with yourself", 400);
  }

  const isBlocked = await BlockedUser.findOne({
    $or: [
      { blocker: userId1, blocked: userId2 },
      { blocker: userId2, blocked: userId1 },
    ],
  });
  if (isBlocked) {
    throw new AppError("Cannot message this user", 403);
  }

  const targetUser = await User.findById(userId2).select("isPrivate");
  if (!targetUser) {
    throw new AppError("User not found", 404);
  }

  if (targetUser.isPrivate) {
    const areFriends = await Request.findOne({
      $or: [
        { sender: userId1, recipient: userId2, status: "accepted" },
        { sender: userId2, recipient: userId1, status: "accepted" },
      ],
    });
    if (!areFriends) {
      throw new AppError(
        "This account is private. Send a friend request first to start a conversation.",
        403,
      );
    }
  }

  let chat = await Chat.findOne({
    isGroup: false,
    members: { $all: [userId1, userId2], $size: 2 },
  }).populate("members", "username fullName avatar isOnline lastSeen isPrivate");

  if (chat) {
    const hiddenIdx = (chat.hiddenBy || [])
      .map((id) => {
        return id.toString();
      })
      .indexOf(userId1.toString());
    if (hiddenIdx !== -1) {
      await Chat.findByIdAndUpdate(chat._id, { $pull: { hiddenBy: userId1 } });
    }
  }

  if (!chat) {
    chat = await Chat.create({ members: [userId1, userId2], isGroup: false });
    chat = (await Chat.findById(chat._id).populate(
      "members",
      "username fullName avatar isOnline lastSeen isPrivate",
    )) as any;
  }

  return chat as IChat;
};

export const getChatById = async (
  chatId: string,
  userId: Types.ObjectId,
): Promise<IChat> => {
  const chat = await Chat.findOne({ _id: chatId, members: userId })
    .populate("members", "username fullName avatar isOnline lastSeen isPrivate")
    .populate("admins", "_id")
    .populate("joinRequests", "username fullName avatar")
    .populate("lastMessage");
  if (!chat) {
    throw new AppError("Chat not found", 404);
  }

  const hiddenBy = (chat.hiddenBy || []) as Types.ObjectId[];
  if (
    hiddenBy
      .map((id) => {
        return id.toString();
      })
      .includes(userId.toString())
  ) {
    await Chat.findByIdAndUpdate(chatId, { $pull: { hiddenBy: userId } });
  }

  const obj = chat.toObject() as unknown as IChat & { unreadCount: number };
  obj.unreadCount =
    (chat.unreadCounts as Map<string, number>)?.get(userId.toString()) || 0;
  return obj;
};

export const getUserChats = async (
  userId: Types.ObjectId,
  page = 1,
): Promise<IChat[]> => {
  const skip = (page - 1) * CHATS_PAGE_LIMIT;
  const chats = await Chat.find({ members: userId, hiddenBy: { $ne: userId } })
    .populate("members", "username fullName avatar isOnline lastSeen")
    .populate("admins", "_id")
    .populate("lastMessage")
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(CHATS_PAGE_LIMIT);

  return chats.map((chat) => {
    const obj = chat.toObject() as unknown as IChat & { unreadCount: number };
    obj.unreadCount =
      (chat.unreadCounts as Map<string, number>)?.get(userId.toString()) || 0;
    return obj;
  });
};

export const createGroup = async ({
  name,
  description,
  isPublic,
  members,
  creatorId,
  groupAvatar,
}: CreateGroupInput): Promise<IChat | null> => {
  const inviteeIds = members.map(String).filter((id) => {
    return id !== creatorId.toString();
  });
  const uniqueInvitees = [...new Set(inviteeIds)];

  if (1 + uniqueInvitees.length > MAX_GROUP_MEMBERS) {
    throw new AppError(`Group cannot exceed ${MAX_GROUP_MEMBERS} members`, 400);
  }

  const chat = await Chat.create({
    name,
    description: description ?? "",
    isPublic: isPublic ?? false,
    isGroup: true,
    members: [creatorId],
    admins: [creatorId],
    createdBy: creatorId,
    groupAvatar: groupAvatar ?? "",
    pendingInvites: uniqueInvitees.map((id) => {
      return new Types.ObjectId(id);
    }),
  });

  if (uniqueInvitees.length > 0) {
    try {
      const admin = await User.findById(creatorId).select("username fullName");
      const adminName = admin?.fullName || admin?.username || "An admin";
      const io = getIO();

      await Promise.all(
        uniqueInvitees.map(async (inviteeId) => {
          const notif = await Notification.create({
            recipient: new Types.ObjectId(inviteeId),
            sender: creatorId,
            type: "group_invite",
            message: `${adminName} invited you to join "${chat.name}"`,
            link: `/requests`,
          });
          io.to(inviteeId).emit("notification:new", notif);
        }),
      );
    } catch {
      
    }
  }

  return Chat.findById(chat._id).populate(
    "members admins",
    "username fullName avatar isOnline",
  );
};

export const updateGroup = async (
  chatId: string,
  userId: Types.ObjectId,
  updates: {
    name?: string;
    description?: string;
    isPublic?: boolean;
    groupAvatar?: string;
  },
): Promise<IChat | null> => {
  const chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroup) {
    throw new AppError("Group not found", 404);
  }
  if (
    !chat.admins
      .map((a) => {
        return a.toString();
      })
      .includes(userId.toString())
  ) {
    throw new AppError("Only admins can update the group", 403);
  }
  if (updates.name !== undefined) {
    chat.name = updates.name;
  }
  if (updates.description !== undefined) {
    chat.description = updates.description;
  }
  if (updates.isPublic !== undefined) {
    chat.isPublic = updates.isPublic;
  }
  if (updates.groupAvatar !== undefined) {
    chat.groupAvatar = updates.groupAvatar;
  }
  await chat.save();
  return Chat.findById(chatId).populate(
    "members admins",
    "username fullName avatar isOnline",
  );
};

export const addMembers = async (
  chatId: string,
  adminId: Types.ObjectId,
  inviteeIds: string[],
): Promise<IChat | null> => {
  const chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroup) {
    throw new AppError("Group not found", 404);
  }
  if (
    !chat.admins
      .map((a) => {
        return a.toString();
      })
      .includes(adminId.toString())
  ) {
    throw new AppError("Only admins can invite members", 403);
  }

  const currentMemberSet = new Set(
    chat.members.map((m) => {
      return m.toString();
    }),
  );
  const currentInviteSet = new Set(
    (chat.pendingInvites || []).map((i) => {
      return i.toString();
    }),
  );
  const newInvitees: string[] = [];
  for (const id of inviteeIds) {
    if (!currentMemberSet.has(id) && !currentInviteSet.has(id)) {
      currentInviteSet.add(id);
      newInvitees.push(id);
    }
  }

  chat.pendingInvites = [...currentInviteSet].map((id) => {
    return new Types.ObjectId(id);
  });
  await chat.save();

  try {
    const admin = await User.findById(adminId).select("username fullName");
    const adminName = admin?.fullName || admin?.username || "An admin";
    const io = getIO();
    await Promise.all(
      newInvitees.map(async (inviteeId) => {
        const notif = await Notification.create({
          recipient: new Types.ObjectId(inviteeId),
          sender: adminId,
          type: "group_invite",
          message: `${adminName} invited you to join "${chat.name}"`,
          link: `/requests`,
        });
        io.to(inviteeId).emit("notification:new", notif);
      }),
    );
  } catch {
    
  }

  return Chat.findById(chatId).populate(
    "members admins",
    "username fullName avatar isOnline",
  ) as Promise<IChat>;
};

export const removeMember = async (
  chatId: string,
  adminId: Types.ObjectId,
  memberId: string,
): Promise<IChat> => {
  const chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroup) {
    throw new AppError("Group not found", 404);
  }
  const isAdmin = chat.admins
    .map((a) => {
      return a.toString();
    })
    .includes(adminId.toString());
  const isSelf = adminId.toString() === memberId.toString();
  if (!isAdmin && !isSelf) {
    throw new AppError("Permission denied", 403);
  }
  chat.members = chat.members.filter((m) => {
    return m.toString() !== memberId;
  });
  chat.admins = chat.admins.filter((a) => {
    return a.toString() !== memberId;
  });

  
  if (chat.members.length === 0) {
    await chat.deleteOne();
    return { _id: chat._id, disbanded: true } as unknown as IChat;
  }
  if (chat.admins.length === 0) {
    chat.admins = [chat.members[0]];
  }

  await chat.save();
  return Chat.findById(chatId).populate(
    "members admins",
    "username fullName avatar isOnline lastSeen",
  ) as Promise<IChat>;
};

export const setDisappearingMessages = async (
  chatId: string,
  userId: Types.ObjectId,
  seconds: number,
): Promise<IChat> => {
  const chat = await Chat.findOne({ _id: chatId, members: userId });
  if (!chat) {
    throw new AppError("Chat not found or access denied", 404);
  }
  if (
    chat.isGroup &&
    !chat.admins
      .map((a) => {
        return a.toString();
      })
      .includes(userId.toString())
  ) {
    throw new AppError(
      "Only admins can change disappearing messages settings",
      403,
    );
  }

  chat.disappearingMessages = seconds;
  await chat.save();

  try {
    const io = getIO();
    chat.members.forEach((memberId) => {
      io.to(memberId.toString()).emit("chat:disappearing_changed", {
        chatId,
        disappearingMessages: seconds,
        by: userId.toString(),
      });
    });
  } catch (socketErr) {
    logger.warn(
      `[setDisappearingMessages] Socket error for chat ${chatId}: ${(socketErr as Error).message}`,
    );
  }

  return Chat.findById(chatId).populate(
    "members admins",
    "username fullName avatar isOnline lastSeen",
  ) as Promise<IChat>;
};

export const leaveGroup = async (
  chatId: string,
  userId: Types.ObjectId,
): Promise<{ disbanded: boolean }> => {
  const chat = await Chat.findOne({
    _id: chatId,
    isGroup: true,
    members: userId,
  });
  if (!chat) {
    throw new AppError("Group not found", 404);
  }
  chat.members = chat.members.filter((m) => {
    return m.toString() !== userId.toString();
  });
  chat.admins = chat.admins.filter((a) => {
    return a.toString() !== userId.toString();
  });
  if (chat.members.length === 0) {
    await chat.deleteOne();
    return { disbanded: true };
  }
  if (chat.admins.length === 0) {
    chat.admins = [chat.members[0]];
  }
  await chat.save();
  return { disbanded: false };
};

export const requestJoinGroup = async (
  chatId: string,
  userId: Types.ObjectId,
): Promise<{ message: string; joined: boolean }> => {
  const chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroup) {
    throw new AppError("Group not found", 404);
  }
  const alreadyMember = chat.members
    .map((m) => {
      return m.toString();
    })
    .includes(userId.toString());
  if (alreadyMember) {
    throw new AppError("You are already a member", 400);
  }

  if (chat.isPublic) {
    if (chat.members.length >= MAX_GROUP_MEMBERS) {
      throw new AppError(
        `Group is full (max ${MAX_GROUP_MEMBERS} members)`,
        400,
      );
    }
    chat.members.push(userId);
    chat.pendingInvites = (chat.pendingInvites || []).filter((i) => {
      return i.toString() !== userId.toString();
    });
    await chat.save();
    return { message: "Joined the group successfully", joined: true };
  }

  const alreadyRequested = chat.joinRequests
    .map((r) => {
      return r.toString();
    })
    .includes(userId.toString());
  if (alreadyRequested) {
    throw new AppError("Join request already sent", 400);
  }
  chat.joinRequests.push(userId);
  await chat.save();

  try {
    const requester = await User.findById(userId).select("username fullName");
    const requesterName =
      requester?.fullName || requester?.username || "Someone";
    const io = getIO();
    await Promise.all(
      chat.admins.map(async (adminId) => {
        const notif = await Notification.create({
          recipient: adminId,
          sender: userId,
          type: "group_join_request",
          message: `${requesterName} wants to join "${chat.name}"`,
          link: `/chats/${chatId}/info`,
        });
        io.to(adminId.toString()).emit("notification:new", notif);
      }),
    );
  } catch {
    
  }

  return {
    message: "Join request sent. Waiting for admin approval.",
    joined: false,
  };
};

export const acceptGroupInvite = async (
  chatId: string,
  userId: Types.ObjectId,
): Promise<{ message: string }> => {
  const chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroup) {
    throw new AppError("Group not found", 404);
  }
  const invited = (chat.pendingInvites || [])
    .map((i) => {
      return i.toString();
    })
    .includes(userId.toString());
  if (!invited) {
    throw new AppError("No invite found for this group", 404);
  }
  if (chat.members.length >= MAX_GROUP_MEMBERS) {
    throw new AppError(`Group is full (max ${MAX_GROUP_MEMBERS} members)`, 400);
  }
  chat.pendingInvites = (chat.pendingInvites || []).filter((i) => {
    return i.toString() !== userId.toString();
  });
  chat.members.push(userId);
  await chat.save();
  return { message: "You have joined the group" };
};

export const rejectGroupInvite = async (
  chatId: string,
  userId: Types.ObjectId,
): Promise<{ message: string }> => {
  const chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroup) {
    throw new AppError("Group not found", 404);
  }
  chat.pendingInvites = (chat.pendingInvites || []).filter((i) => {
    return i.toString() !== userId.toString();
  });
  await chat.save();
  return { message: "Invite declined" };
};

export const getMyGroupInvites = async (
  userId: Types.ObjectId,
): Promise<IChat[]> => {
  const chats = await Chat.find({ isGroup: true, pendingInvites: userId })
    .populate("members admins", "username fullName avatar isOnline")
    .populate("createdBy", "username fullName avatar")
    .sort({ updatedAt: -1 });
  return chats as IChat[];
};

export const getJoinRequests = async (
  chatId: string,
  adminId: Types.ObjectId,
): Promise<IChat | null> => {
  const chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroup) {
    throw new AppError("Group not found", 404);
  }
  if (
    !chat.admins
      .map((a) => {
        return a.toString();
      })
      .includes(adminId.toString())
  ) {
    throw new AppError("Only admins can view join requests", 403);
  }
  return Chat.findById(chatId)
    .populate("joinRequests", "username fullName avatar")
    .populate("members admins", "username fullName avatar isOnline");
};

export const handleJoinRequest = async (
  chatId: string,
  adminId: Types.ObjectId,
  requesterId: string,
  action: "accept" | "reject",
): Promise<IChat | null> => {
  const chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroup) {
    throw new AppError("Group not found", 404);
  }
  if (
    !chat.admins
      .map((a) => {
        return a.toString();
      })
      .includes(adminId.toString())
  ) {
    throw new AppError("Only admins can manage join requests", 403);
  }
  const inQueue = chat.joinRequests
    .map((r) => {
      return r.toString();
    })
    .includes(requesterId);
  if (!inQueue) {
    throw new AppError("No join request from this user", 404);
  }

  chat.joinRequests = chat.joinRequests.filter((r) => {
    return r.toString() !== requesterId;
  });
  if (action === "accept") {
    if (chat.members.length >= MAX_GROUP_MEMBERS) {
      throw new AppError(
        `Group is full (max ${MAX_GROUP_MEMBERS} members)`,
        400,
      );
    }
    chat.members.push(new Types.ObjectId(requesterId));
  }
  await chat.save();
  return Chat.findById(chatId)
    .populate("joinRequests", "username fullName avatar")
    .populate("members admins", "username fullName avatar isOnline");
};

export const searchGroups = async (
  query: string,
  userId: Types.ObjectId,
  page = 1,
): Promise<PaginatedResult<Record<string, unknown>>> => {
  const limit = 20;
  const skip = (page - 1) * limit;
  const trimmed = query.trim();
  if (!trimmed) {
    return { data: [], total: 0, page, hasMore: false };
  }

  const filter = {
    isGroup: true,
    name: { $regex: escapeRegex(trimmed), $options: "i" },
  };

  const [groups, total] = await Promise.all([
    Chat.find(filter)
      .select(
        "name description isPublic groupAvatar members admins joinRequests pendingInvites",
      )
      .skip(skip)
      .limit(limit),
    Chat.countDocuments(filter),
  ]);

  const data = groups.map((g) => {
    const obj = g.toObject() as unknown as Record<string, unknown>;
    const memberList = g.members as Types.ObjectId[];
    const joinRequestList = (g.joinRequests || []) as Types.ObjectId[];
    const pendingInviteList = (g.pendingInvites || []) as Types.ObjectId[];
    obj.memberCount = memberList.length;
    obj.isMember = memberList
      .map((m) => {
        return m.toString();
      })
      .includes(userId.toString());
    obj.hasRequested = joinRequestList
      .map((r) => {
        return r.toString();
      })
      .includes(userId.toString());
    obj.isInvited = pendingInviteList
      .map((i) => {
        return i.toString();
      })
      .includes(userId.toString());
    // Only expose the derived flags, never the raw id lists of the group.
    delete obj.members;
    delete obj.admins;
    delete obj.joinRequests;
    delete obj.pendingInvites;
    return obj;
  });

  return { data, total, page, hasMore: skip + groups.length < total };
};

export const togglePinMessage = async (
  chatId: string,
  messageId: string,
  userId: Types.ObjectId,
): Promise<IChat | null> => {
  const chat = await Chat.findOne({ _id: chatId, members: userId });
  if (!chat) {
    throw new AppError("Chat not found or access denied", 404);
  }

  const isPinned = chat.pinnedMessages
    .map((p) => {
      return p.toString();
    })
    .includes(messageId);

  // Only messages of this very chat can be pinned. Otherwise a member could pin
  // an arbitrary message id and read it through the populated pinnedMessages.
  if (!isPinned) {
    const belongsToChat = await Message.exists({ _id: messageId, chat: chatId });
    if (!belongsToChat) {
      throw new AppError("Message not found in this chat", 404);
    }
  }

  if (chat.isGroup) {
    if (
      !chat.admins
        .map((a) => {
          return a.toString();
        })
        .includes(userId.toString())
    ) {
      throw new AppError("Only admins can pin messages", 403);
    }
  }

  if (isPinned) {
    chat.pinnedMessages = chat.pinnedMessages.filter((p) => {
      return p.toString() !== messageId;
    });
  } else {
    chat.pinnedMessages.push(new Types.ObjectId(messageId));
  }

  await chat.save();
  return Chat.findById(chatId)
    .populate("members admins", "username fullName avatar isOnline")
    .populate("pinnedMessages");
};

export const getMessages = async (
  chatId: string,
  userId: Types.ObjectId,
  page = 1,
): Promise<PaginatedResult<IMessage>> => {
  const skip = (page - 1) * MESSAGE_LIMIT;
  const chat = await Chat.findOne({ _id: chatId, members: userId });
  if (!chat) {
    throw new AppError("Chat not found or access denied", 403);
  }

  const [messages, total] = await Promise.all([
    Message.find({
      chat: chatId,
      isDeleted: false,
      deletedFor: { $ne: userId },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(MESSAGE_LIMIT)
      .populate("sender", "username fullName avatar")
      .populate("replyTo"),
    Message.countDocuments({
      chat: chatId,
      isDeleted: false,
      deletedFor: { $ne: userId },
    }),
  ]);

  return {
    data: messages.reverse() as IMessage[],
    total,
    page,
    hasMore: skip + messages.length < total,
  };
};

export const hideChat = async (
  chatId: string,
  userId: Types.ObjectId,
): Promise<void> => {
  const chat = await Chat.findOne({ _id: chatId, members: userId });
  if (!chat) {
    throw new AppError("Chat not found", 404);
  }
  await Chat.findByIdAndUpdate(chatId, { $addToSet: { hiddenBy: userId } });
};
