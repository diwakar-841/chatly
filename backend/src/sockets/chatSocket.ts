import { Server, Socket } from 'socket.io';
import Chat from '../models/Chat.js';
import logger from '../utils/logger.js';
import { IUser } from '../types/index.js';
import { markDelivered } from '../services/messageService.js';

interface AuthenticatedSocket extends Socket {
  user: IUser;
}

/**
 * Registers chat-related socket event handlers for a single connection.
 * Handles room membership, typing indicators, and message delivery updates.
 */
export default (io: Server, socket: AuthenticatedSocket): void => {
  /** Joins the Socket.IO room for a specific chat so the client receives its events. */
  socket.on('chat:join', (chatId: string) => {
    socket.join(chatId);
  });

  /** Leaves the Socket.IO room for a specific chat. */
  socket.on('chat:leave', (chatId: string) => {
    socket.leave(chatId);
  });

  /**
   * Marks messages in a chat as delivered for the current user.
   */
  socket.on('message:delivered', async ({ chatId }: { chatId: string }) => {
    try {
      await markDelivered(chatId, socket.user._id);
    } catch (err) {
      logger.error(
        `message:delivered error for user ${socket.user._id}: ${
          (err as Error).message
        }`
      );
    }
  });

  /**
   * Broadcasts a typing indicator to all other members in the chat room.
   * Validates membership before emitting to prevent spoofing.
   */
  socket.on(
    'chat:typing',
    async ({ chatId, isTyping }: { chatId: string; isTyping: boolean }) => {
      try {
        const chat = await Chat.findOne({
          _id: chatId,
          members: socket.user._id,
        });

        if (!chat) return;

        socket.to(chatId).emit('chat:typing', {
          chatId,
          userId: socket.user._id,
          username: socket.user.username,
          isTyping,
        });
      } catch (err) {
        logger.error(
          `chat:typing error for user ${socket.user._id}: ${
            (err as Error).message
          }`
        );
      }
    }
  );
};
