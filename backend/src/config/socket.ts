import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Chat from "../models/Chat.js";
import BlockedUser from "../models/BlockedUser.js";
import Request from "../models/Request.js";
import chatSocket from "../sockets/chatSocket.js";
import callSocket from "../sockets/callSocket.js";
import notificationSocket from "../sockets/notificationSocket.js";
import userSocket from "../sockets/userSocket.js";
import logger from "../utils/logger.js";
import { IUser } from "../types/index.js";

interface AuthenticatedSocket extends Socket {
  user: IUser;
}

let io: Server;

const getAllowedOrigins = (): string[] => {
  return (process.env.CLIENT_URL ?? "http://localhost:5173")
    .split(",")
    .map((o) => {
      return o.trim();
    });
};

const getExcludedFromPresence = async (
  userId: string,
): Promise<Set<string>> => {
  const excluded = new Set<string>();

  const [blocks, dmChats, friendships] = await Promise.all([
    BlockedUser.find({$or: [{ blocker: userId }, { blocked: userId }],}).select("blocker blocked"),
    Chat.find({ isGroup: false, members: userId }).select("members"),
    Request.find({
      $or: [
        { sender: userId, status: "accepted" },
        { recipient: userId, status: "accepted" },
      ],
    }).select("sender recipient"),
  ]);

  for (const b of blocks) {
    excluded.add(
      b.blocker.toString() === userId
        ? b.blocked.toString()
        : b.blocker.toString(),
    );
  }

  const friendIds = new Set<string>(
    friendships.map((r) => {
      return r.sender.toString() === userId
        ? r.recipient.toString()
        : r.sender.toString();
    }),
  );

  for (const chat of dmChats) {
    for (const memberId of chat.members) {
      const id = memberId.toString();
      if (id !== userId && !friendIds.has(id)) {
        excluded.add(id);
      }
    }
  }

  return excluded;
};

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: (origin, cb) => {
        const allowed = getAllowedOrigins();
        if (!origin || allowed.includes(origin)) {
          return cb(null, true);
        }
        cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  
  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: string }).token;
      if (!token) {
        return next(new Error("Authentication error"));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        id: string;
      };
      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        return next(new Error("User not found"));
      }
      (socket as AuthenticatedSocket).user = user;
      next();
    } catch {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const s = socket as AuthenticatedSocket;
    const myId = s.user._id.toString();
    logger.info(`Socket connected: ${myId}`);

    // IMPORTANT: join the personal room and attach every event handler
    // synchronously, before any `await`. Socket.IO does not buffer client
    // events for handlers that are not registered yet, so awaiting DB calls
    // first made early events (e.g. "chat:join") get silently dropped.
    void socket.join(myId);
    chatSocket(io, s);
    callSocket(io, s);
    notificationSocket(io, s);
    userSocket(io, s);

    // Contacts (chat members) that this user is allowed to be seen by.
    const getVisibleContactIds = async (): Promise<string[]> => {
      const chats = await Chat.find({ members: s.user._id }).select("members");
      const contactIds = new Set<string>();
      for (const chat of chats) {
        for (const memberId of chat.members) {
          const id = memberId.toString();
          if (id !== myId) {
            contactIds.add(id);
          }
        }
      }
      const excludedIds = await getExcludedFromPresence(myId);
      return [...contactIds].filter((id) => {
        return !excludedIds.has(id);
      });
    };

    socket.on("disconnect", async () => {
      logger.info(`Socket disconnected: ${myId}`);
      try {
        // The same user may still be connected from another tab/device. Only
        // go offline when the last socket is gone.
        const remaining = await io.in(myId).fetchSockets();
        if (remaining.length > 0) {
          return;
        }

        const lastSeen = new Date();
        await User.findByIdAndUpdate(s.user._id, { isOnline: false, lastSeen });

        for (const contactId of await getVisibleContactIds()) {
          io.to(contactId).emit("user:offline", { userId: myId, lastSeen });
        }
      } catch (err) {
        logger.warn(
          `[presence] disconnect error for user ${myId}: ${(err as Error).message}`,
        );
      }
    });

    // Presence announcement. Errors are contained here: an uncaught rejection
    // would otherwise reach the process-level handler and kill the server.
    void (async () => {
      try {
        await User.findByIdAndUpdate(s.user._id, {
          isOnline: true,
          lastSeen: new Date(),
        });

        const visibleContactIds = await getVisibleContactIds();
        for (const contactId of visibleContactIds) {
          socket.to(contactId).emit("user:online", { userId: myId });
        }

        const onlineContactIds: string[] = [];
        for (const contactId of visibleContactIds) {
          const sockets = await io.in(contactId).fetchSockets();
          if (sockets.length > 0) {
            onlineContactIds.push(contactId);
          }
        }
        socket.emit("user:online_contacts", { userIds: onlineContactIds });
      } catch (err) {
        logger.warn(
          `[presence] connect error for user ${myId}: ${(err as Error).message}`,
        );
      }
    })();
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};
