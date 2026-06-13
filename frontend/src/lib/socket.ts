import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Connects to the Socket.IO server using the provided JWT. If a connection
 * is already active it is returned immediately; a stale disconnected socket
 * is replaced before connecting.
 */
export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;
  socket?.disconnect();
  const url = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
  socket = io(url, { auth: { token }, transports: ["websocket"], withCredentials: true });
  return socket;
}

/** Returns the current socket instance or null if not connected. */
export function getSocket(): Socket | null {
  return socket;
}

/** Disconnects the socket and clears the module-level reference. */
export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
