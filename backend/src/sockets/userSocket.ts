import { Server, Socket } from 'socket.io';
import { IUser } from '../types/index.js';

interface AuthenticatedSocket extends Socket {
  user: IUser;
}

/**
 * Registers user-level socket event handlers for a single connection.
 * Currently provides a basic ping/pong for connectivity testing.
 */
export default (_io: Server, socket: AuthenticatedSocket): void => {
  /** Echoes a pong back to the client; used for latency checks and keep-alive. */
  socket.on('user:ping', () => {
    socket.emit('user:pong');
  });
};
