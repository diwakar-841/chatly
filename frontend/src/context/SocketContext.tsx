import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useAuth } from "@/store/auth";

interface Ctx {
  socket: Socket | null;
  onlineUsers: Set<string>;
  unreadNotifCount: number;
  pendingRequestCount: number;
  groupInviteCount: number;
  setUnreadNotifCount: (n: number | ((prev: number) => number)) => void;
  setPendingRequestCount: (n: number | ((prev: number) => number)) => void;
  setGroupInviteCount: (n: number | ((prev: number) => number)) => void;

  /** Immediately removes a user from the online set (e.g. after block or unfriend). */
  removeOnlineUser: (userId: string) => void;
}

const SocketContext = createContext<Ctx>({
  socket: null,
  onlineUsers: new Set(),
  unreadNotifCount: 0,
  pendingRequestCount: 0,
  groupInviteCount: 0,
  setUnreadNotifCount: () => {},
  setPendingRequestCount: () => {},
  setGroupInviteCount: () => {},
  removeOnlineUser: () => {},
});

/**
 * Provides a single Socket.IO connection for the entire app.
 * Connects when an access token is present, disconnects on logout.
 * Maintains a live set of online user IDs and global badge counters
 * for notifications, requests, and group invites.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.accessToken);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [groupInviteCount, setGroupInviteCount] = useState(0);

  const setUnread = useCallback(
    (n: number | ((prev: number) => number)) => setUnreadNotifCount(n),
    []
  );

  const setPending = useCallback(
    (n: number | ((prev: number) => number)) => setPendingRequestCount(n),
    []
  );

  const setInvites = useCallback(
    (n: number | ((prev: number) => number)) => setGroupInviteCount(n),
    []
  );

  const removeOnlineUser = useCallback((userId: string) => {
    setOnlineUsers((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setSocket(null);
      setOnlineUsers(new Set());
      return;
    }

    const s = connectSocket(token);
    setSocket(s);

    const onOnlineContacts = ({ userIds }: { userIds: string[] }) => {
      setOnlineUsers(new Set(userIds));
    };

    const onOnline = ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => new Set(prev).add(userId));
    };

    const onOffline = ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    /**
     * Clears the online set on reconnect;
     * the server will re-send `user:online_contacts`.
     */
    const onReconnect = () => {
      setOnlineUsers(new Set());
    };

    const onNotification = (notif: { type?: string }) => {
      if (notif?.type !== "message") {
        setUnreadNotifCount((c) => c + 1);
      }

      if (notif?.type === "group_invite") {
        setGroupInviteCount((c) => c + 1);
      }
    };

    const onRequest = () => {
      setPendingRequestCount((c) => c + 1);
    };

    /**
     * Automatically mark messages as delivered when received.
     */
    const onIncomingMessage = (msg: { chat?: string }) => {
      if (msg?.chat) {
        s.emit("message:delivered", {
          chatId: msg.chat,
        });
      }
    };

    /**
     * Handles block/unblock/unfriend presence changes.
     * For "blocked" and "unfriended" the actor is removed
     * from onlineUsers immediately so the green dot disappears
     * across all pages without a re-fetch.
     */
    const onStatusChanged = ({
      status,
      by,
    }: {
      chatId: string;
      status: string;
      by: string;
    }) => {
      if (status === "blocked" || status === "unfriended") {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(by);
          return next;
        });
      }
    };

    s.on("user:online_contacts", onOnlineContacts);
    s.on("user:online", onOnline);
    s.on("user:offline", onOffline);
    s.on("reconnect", onReconnect);
    s.on("notification:new", onNotification);
    s.on("request:new", onRequest);
    s.on("message:new", onIncomingMessage);
    s.on("chat:status_changed", onStatusChanged);

    return () => {
      s.off("user:online_contacts", onOnlineContacts);
      s.off("user:online", onOnline);
      s.off("user:offline", onOffline);
      s.off("reconnect", onReconnect);
      s.off("notification:new", onNotification);
      s.off("request:new", onRequest);
      s.off("message:new", onIncomingMessage);
      s.off("chat:status_changed", onStatusChanged);
    };
  }, [token]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        onlineUsers,
        unreadNotifCount,
        pendingRequestCount,
        groupInviteCount,
        setUnreadNotifCount: setUnread,
        setPendingRequestCount: setPending,
        setGroupInviteCount: setInvites,
        removeOnlineUser,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

/** Hook for accessing the socket context from any child component. */
export const useSocket = () => useContext(SocketContext);
