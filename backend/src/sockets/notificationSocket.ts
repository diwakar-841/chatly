import { Server, Socket } from 'socket.io';
import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';
import { IUser } from '../types/index.js';

interface AuthenticatedSocket extends Socket {
  user: IUser;
}

/**
 * Registers notification-related socket event handlers for a single connection.
 * Allows clients to acknowledge a notification without making a full HTTP round-trip.
 */
export default (io: Server, socket: AuthenticatedSocket): void => {
  /**
   * Marks a notification as read via socket. Ownership is verified against the
   * authenticated user before persisting; the client is notified of the update.
   */
  socket.on('notification:read', async (notificationId: string) => {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: socket.user._id },
        { isRead: true },
        { new: true }
      );
      if (notification) socket.emit('notification:updated', { notificationId, isRead: true });
    } catch (err) {
      logger.error(`notification:read error for user ${socket.user._id}: ${(err as Error).message}`);
    }
  });
};
