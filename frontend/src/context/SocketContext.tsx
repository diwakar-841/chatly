import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
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


export function SocketProvider({ children }: { children: ReactNode }) {
  const token = useAuth(s => {
    return s.accessToken;
  });

  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [groupInviteCount, setGroupInviteCount] = useState(0);

  const setUnread = useCallback((n: number | ((prev: number) => number)) => {
    return setUnreadNotifCount(n);
  }, []);

  const setPending = useCallback((n: number | ((prev: number) => number)) => {
    return setPendingRequestCount(n);
  }, []);

  const setInvites = useCallback((n: number | ((prev: number) => number)) => {
    return setGroupInviteCount(n);
  }, []);

  const removeOnlineUser = useCallback((userId: string) => {
    setOnlineUsers(prev => {
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
      setOnlineUsers(prev => {
        return new Set(prev).add(userId);
      });
    };

    const onOffline = ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    
    const onReconnect = () => {
      setOnlineUsers(new Set());
    };

    const onNotification = (notif: { type?: string }) => {
      if (notif?.type !== "message") {
        setUnreadNotifCount(c => {
          return c + 1;
        });
      }

      if (notif?.type === "group_invite") {
        setGroupInviteCount(c => {
          return c + 1;
        });
      }
    };

    const onRequest = () => {
      setPendingRequestCount(c => {
        return c + 1;
      });
    };

    
    const onIncomingMessage = (msg: { chat?: string }) => {
      if (msg?.chat) {
        s.emit("message:delivered", { chatId: msg.chat });
      }
    };

    
    const onStatusChanged = ({ status, by }: { chatId: string; status: string; by: string }) => {
      if (status === "blocked" || status === "unfriended") {
        setOnlineUsers(prev => {
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


export const useSocket = () => {
  return useContext(SocketContext);
};
