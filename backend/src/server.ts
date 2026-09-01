import "dotenv/config";
import http from "http";
import app from "./app.js";
import connectDB, { disconnectDB } from "./config/db.js";
import { initSocket } from "./config/socket.js";
import logger from "./utils/logger.js";

const PORT = process.env.PORT ?? "5000";

const server = http.createServer(app);

initSocket(server);

const start = async (): Promise<void> => {
  await connectDB();
  server.listen(PORT, () => {
    logger.info(
      `Server running on port ${PORT} in ${process.env.NODE_ENV ?? "development"} mode`,
    );
  });
};

void start();


const shutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    await disconnectDB();
    logger.info("Server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => {
  return void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  return void shutdown("SIGINT");
});

process.on("unhandledRejection", (err: unknown) => {
  logger.error(`Unhandled Rejection: ${(err as Error).message}`);
  server.close(() => {
    return process.exit(1);
  });
});

process.on("uncaughtException", (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});
