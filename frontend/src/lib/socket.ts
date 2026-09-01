import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }
  socket?.disconnect();
  const url = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
  socket = io(url, { auth: { token }, transports: ["websocket"], withCredentials: true });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
