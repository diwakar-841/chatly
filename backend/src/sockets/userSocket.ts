import { Server, Socket } from "socket.io";
import { IUser } from "../types/index.js";

interface AuthenticatedSocket extends Socket {
  user: IUser;
}

export default (_io: Server, socket: AuthenticatedSocket): void => {
  
  socket.on("user:ping", () => {
    socket.emit("user:pong");
  });
};
