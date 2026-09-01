import { Server, Socket } from "socket.io";
import Chat from "../models/Chat.js";
import BlockedUser from "../models/BlockedUser.js";
import logger from "../utils/logger.js";
import { IUser } from "../types/index.js";

interface AuthenticatedSocket extends Socket {
  user: IUser;
}

type CallType = "audio" | "video";

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

const validatePeer = async (
  meId: string,
  otherId: string,
): Promise<boolean> => {
  const [chat, block] = await Promise.all([
    Chat.findOne({ isGroup: false, members: { $all: [meId, otherId] } }).select(
      "_id",
    ),
    BlockedUser.findOne({
      $or: [
        { blocker: meId, blocked: otherId },
        { blocker: otherId, blocked: meId },
      ],
    }).select("_id"),
  ]);
  return Boolean(chat) && !block;
};

export default (io: Server, socket: AuthenticatedSocket): void => {
  const myId = socket.user._id.toString();

  
  socket.on(
    "call:initiate",
    async ({ to, chatId, callType, offer }: CallPayload) => {
      try {
        if (!to || !offer) {
          return;
        }
        const allowed = await validatePeer(myId, to);
        if (!allowed) {
          socket.emit("call:failed", { reason: "You cannot call this user." });
          return;
        }

        const targetSockets = await io.in(to).fetchSockets();
        if (targetSockets.length === 0) {
          socket.emit("call:unavailable", { to });
          return;
        }

        io.to(to).emit("call:incoming", {
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
        logger.error(
          `call:initiate error for ${myId}: ${(err as Error).message}`,
        );
        socket.emit("call:failed", { reason: "Call could not be started." });
      }
    },
  );

  
  socket.on(
    "call:accept",
    ({ to, answer }: { to: string; answer: RTCSessionDescriptionInitLike }) => {
      if (!to || !answer) {
        return;
      }
      io.to(to).emit("call:accepted", { from: myId, answer });
    },
  );

  
  socket.on("call:reject", ({ to }: { to: string }) => {
    if (!to) {
      return;
    }
    io.to(to).emit("call:rejected", { from: myId });
  });

  
  socket.on("call:end", ({ to }: { to: string }) => {
    if (!to) {
      return;
    }
    io.to(to).emit("call:ended", { from: myId });
  });

  
  socket.on(
    "call:ice-candidate",
    ({ to, candidate }: { to: string; candidate: unknown }) => {
      if (!to || !candidate) {
        return;
      }
      io.to(to).emit("call:ice-candidate", { from: myId, candidate });
    },
  );
};
