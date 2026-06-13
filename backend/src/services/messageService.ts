import validator from 'validator';
import { Types } from 'mongoose';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import BlockedUser from '../models/BlockedUser.js';
import Notification from '../models/Notification.js';
import { getIO } from '../config/socket.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { IMessage, SendMessageInput } from '../types/index.js';
import User from '../models/User.js';
import Request from '../models/Request.js';

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Sends a message to a chat room. Enforces block and friendship rules for DMs,
 * sanitises content, increments per-member unread counts, and emits socket
 * events + notifications to every other member.
 */
export const sendMessage = async ({
  chatId, content, type, replyTo, mediaUrl, senderId, senderUsername,
}: SendMessageInput): Promise<IMessage> => {
  const sanitizedContent = content
    ? validator.escape(String(content).trim()).slice(0, MAX_MESSAGE_LENGTH)
    : '';

  if (!sanitizedContent && !mediaUrl) throw new AppError('Message must have content or a file', 400);

  const chat = await Chat.findOne({ _id: chatId, members: senderId });
  if (!chat) throw new AppError('Access denied', 403);

  if (!chat.isGroup) {
    const otherMember = chat.members.find((m) => m.toString() !== senderId.toString());
    if (otherMember) {
      const block = await BlockedUser.findOne({
        $or: [{ blocker: senderId, blocked: otherMember }, { blocker: otherMember, blocked: senderId }],
      });
      if (block) throw new AppError('Cannot send messages to this user', 403);

      const otherUser = await User.findById(otherMember).select('isPrivate');
      if (otherUser?.isPrivate !== false) {
        const friendship = await Request.findOne({
          $or: [
            { sender: senderId, recipient: otherMember, status: 'accepted' },
            { sender: otherMember, recipient: senderId, status: 'accepted' },
          ],
        });
        if (!friendship) throw new AppError('You are no longer friends with this user', 403);
      }
    }
  }

  const message = await Message.create({
    chat: chatId, sender: senderId,
    content: sanitizedContent, type: type ?? 'text',
    mediaUrl: mediaUrl ?? '', replyTo: replyTo ?? null,
    readBy: [senderId],
  });

  await Chat.findByIdAndUpdate(chatId, {
    $set: { lastMessage: message._id },
    $inc: Object.fromEntries(
      chat.members
        .filter((m) => m.toString() !== senderId.toString())
        .map((m) => [`unreadCounts.${m.toString()}`, 1])
    ),
  });

  const populated = (await Message.findById(message._id)
    .populate('sender', 'username fullName avatar')
    .populate('replyTo')) as IMessage;

  try {
    const io = getIO();
    await Promise.all(
      chat.members
        .filter((memberId) => memberId.toString() !== senderId.toString())
        .map(async (memberId) => {
          io.to(memberId.toString()).emit('message:new', populated);
          const n = await Notification.create({
            recipient: memberId, sender: senderId, type: 'message',
            message: `New message from ${senderUsername}`,
            link: `/chats/${chatId}`,
          });
          io.to(memberId.toString()).emit('notification:new', n);
        })
    );
  } catch (socketErr) {
    logger.warn(`[sendMessage] Socket/notification error for chat ${chatId}: ${(socketErr as Error).message}`);
  }

  return populated;
};

/** Soft-deletes a message by blanking its content and setting isDeleted; broadcasts to all chat members. */
export const deleteMessage = async (messageId: string, userId: Types.ObjectId): Promise<IMessage> => {
  const message = await Message.findOne({ _id: messageId, sender: userId });
  if (!message) throw new AppError('Message not found', 404);
  message.isDeleted = true;
  message.content = '';
  message.mediaUrl = '';
  await message.save();

  try {
    const io = getIO();
    const chat = await Chat.findById(message.chat);
    chat?.members.forEach((memberId) => {
      io.to(memberId.toString()).emit('message:deleted', { messageId: message._id, chatId: message.chat });
    });
  } catch (socketErr) {
    logger.warn(`[deleteMessage] Socket error for message ${messageId}: ${(socketErr as Error).message}`);
  }

  return message;
};

/**
 * Adds, replaces, or removes a reaction on a message. Adding the same emoji
 * again toggles it off; a different emoji replaces the existing one.
 * Broadcasts the updated reaction array to all chat members.
 */
export const reactToMessage = async (
  messageId: string, userId: Types.ObjectId, emoji: string
): Promise<IMessage> => {
  if (!emoji || typeof emoji !== 'string' || emoji.length > 10) throw new AppError('Invalid emoji', 400);
  const message = await Message.findById(messageId);
  if (!message) throw new AppError('Message not found', 404);
  const chat = await Chat.findOne({ _id: message.chat, members: userId });
  if (!chat) throw new AppError('Access denied', 403);

  const existingIdx = message.reactions.findIndex((r) => r.user.toString() === userId.toString());
  if (existingIdx >= 0) {
    if (message.reactions[existingIdx].emoji === emoji) {
      message.reactions.splice(existingIdx, 1);
    } else {
      message.reactions[existingIdx].emoji = emoji;
    }
  } else {
    message.reactions.push({ user: userId, emoji });
  }
  await message.save();

  try {
    const io = getIO();
    chat.members.forEach((memberId) => {
      io.to(memberId.toString()).emit('message:reaction', {
        messageId: message._id, chatId: message.chat, reactions: message.reactions,
      });
    });
  } catch (socketErr) {
    logger.warn(`[reactToMessage] Socket error for message ${messageId}: ${(socketErr as Error).message}`);
  }

  return message;
};

/**
 * Marks all unread messages in the chat as read by the user, resets the user's
 * unread count, and notifies the user's own sessions and other members via socket.
 */
export const markRead = async (chatId: string, userId: Types.ObjectId): Promise<void> => {
  const chat = await Chat.findOne({ _id: chatId, members: userId });
  if (!chat) throw new AppError('Chat not found or access denied', 403);

  await Message.updateMany(
    { chat: chatId, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } }
  );

  await Chat.findByIdAndUpdate(chatId, { $set: { [`unreadCounts.${userId.toString()}`]: 0 } });

  try {
    const io = getIO();
    io.to(userId.toString()).emit('chat:read', { chatId });
    chat.members.forEach((memberId) => {
      if (memberId.toString() !== userId.toString()) {
        io.to(memberId.toString()).emit('message:read', { chatId, readBy: userId });
      }
    });
  } catch (socketErr) {
    logger.warn(`[markRead] Socket error for chat ${chatId}: ${(socketErr as Error).message}`);
  }
};

/**
 * Clears messages in a chat. When `forBoth` is true, marks the sender's
 * messages as globally deleted and broadcasts the event. Otherwise, adds
 * the user to each message's `deletedFor` array (visible only to them).
 */
export const clearChat = async (chatId: string, userId: Types.ObjectId, forBoth: boolean): Promise<void> => {
  const chat = await Chat.findOne({ _id: chatId, members: userId });
  if (!chat) throw new AppError('Chat not found or access denied', 403);

  if (forBoth) {
    await Message.updateMany(
      { chat: chatId, sender: userId },
      { isDeleted: true, content: '', mediaUrl: '' }
    );
    try {
      const io = getIO();
      chat.members.forEach((memberId) => {
        io.to(memberId.toString()).emit('chat:cleared', {
          chatId, forBoth: true, senderId: userId.toString(),
        });
      });
    } catch (socketErr) {
      logger.warn(`[clearChat] Socket error: ${(socketErr as Error).message}`);
    }
  } else {
    await Message.updateMany(
      { chat: chatId, deletedFor: { $ne: userId } },
      { $addToSet: { deletedFor: userId } }
    );
  }
};
