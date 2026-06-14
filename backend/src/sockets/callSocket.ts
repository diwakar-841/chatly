import { Server, Socket } from 'socket.io';
import Chat from '../models/Chat.js';
import BlockedUser from '../models/BlockedUser.js';
import logger from '../utils/logger.js';
import { IUser } from '../types/index.js';

interface AuthenticatedSocket extends Socket {
  user: IUser;
}

type CallType = 'audio' | 'video';

/** Minimal structural type so we don't depend on DOM lib types on the server. */
interface RTCSessionDescriptionInitLike {
  type: string;
  sdp?: string;
}

interface CallPayload {
  to: string;
  chatId: string;
  callType: CallType;
  offer?: RTCSessionDescriptionInitLike;
}

/**
 * Verifies that the two users share a 1-to-1 chat and that neither has blocked
 * the other. Returns true only when a call between them is permitted.
 */
const validatePeer = async (meId: string, otherId: string): Promise<boolean> => {
  const [chat, block] = await Promise.all([
    Chat.findOne({ isGroup: false, members: { $all: [meId, otherId] } }).select('_id'),
    BlockedUser.findOne({
      $or: [
        { blocker: meId, blocked: otherId },
        { blocker: otherId, blocked: meId },
      ],
    }).select('_id'),
  ]);
  return Boolean(chat) && !block;
};

/**
 * Registers WebRTC signaling handlers for a single connection. All events are
 * relayed to the target user's personal room (the user id room joined on
 * connect). The server never touches media — it only forwards SDP and ICE.
 */
export default (io: Server, socket: AuthenticatedSocket): void => {
  const myId = socket.user._id.toString();

  /** Caller -> Callee: ring the target with an SDP offer. */
  socket.on('call:initiate', async ({ to, chatId, callType, offer }: CallPayload) => {
    try {
      if (!to || !offer) return;
      const allowed = await validatePeer(myId, to);
      if (!allowed) {
        socket.emit('call:failed', { reason: 'You cannot call this user.' });
        return;
      }

      const targetSockets = await io.in(to).fetchSockets();
      if (targetSockets.length === 0) {
        socket.emit('call:unavailable', { to });
        return;
      }

      io.to(to).emit('call:incoming', {
        from: myId,
        chatId,
        callType,
        offer,
        caller: {
          _id: myId,
          username: socket.user.username,
          fullName: socket.user.fullName,
          avatar: socket.user.avatar,
        },
      });
    } catch (err) {
      logger.error(`call:initiate error for ${myId}: ${(err as Error).message}`);
      socket.emit('call:failed', { reason: 'Call could not be started.' });
    }
  });

  /** Callee -> Caller: accept the call with an SDP answer. */
  socket.on('call:accept', ({ to, answer }: { to: string; answer: RTCSessionDescriptionInitLike }) => {
    if (!to || !answer) return;
    io.to(to).emit('call:accepted', { from: myId, answer });
  });

  /** Callee -> Caller: decline an incoming call. */
  socket.on('call:reject', ({ to }: { to: string }) => {
    if (!to) return;
    io.to(to).emit('call:rejected', { from: myId });
  });

  /** Either side: hang up / cancel a ringing or in-progress call. */
  socket.on('call:end', ({ to }: { to: string }) => {
    if (!to) return;
    io.to(to).emit('call:ended', { from: myId });
  });

  /** Bidirectional trickle-ICE candidate exchange. */
  socket.on('call:ice-candidate', ({ to, candidate }: { to: string; candidate: unknown }) => {
    if (!to || !candidate) return;
    io.to(to).emit('call:ice-candidate', { from: myId, candidate });
  });
};
