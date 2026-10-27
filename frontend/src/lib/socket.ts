import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/store/auth";

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }
  socket?.disconnect();
  const url = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
  // `auth` as a callback is evaluated on every (re)connect attempt, so a
  // reconnect after the access token was refreshed uses the NEW token instead
  // of the stale one captured here (which made reconnects fail with
  // "Authentication error" after ~15 minutes).
  socket = io(url, {
    auth: cb => {
      cb({ token: useAuth.getState().accessToken ?? token });
    },
    transports: ["websocket"],
    withCredentials: true,
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
