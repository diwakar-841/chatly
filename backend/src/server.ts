import "dotenv/config";
import http from "http";
import app from "./app.js";
import connectDB, { disconnectDB } from "./config/db.js";
import { initSocket, getIO } from "./config/socket.js";
import logger from "./utils/logger.js";

const PORT = process.env.PORT ?? "5000";

const server = http.createServer(app);

initSocket(server);

const start = async (): Promise<void> => {
  // Fail fast: without a secret every login/register would crash at runtime.
  if (!process.env.JWT_SECRET) {
    logger.error("JWT_SECRET is not set — check your .env file");
    process.exit(1);
  }
  await connectDB();
  server.listen(PORT, () => {
    logger.info(
      `Server running on port ${PORT} in ${process.env.NODE_ENV ?? "development"} mode`,
    );
  });
};

void start();

let shuttingDown = false;

const shutdown = (reason: string, exitCode = 0): void => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info(`${reason} — shutting down gracefully`);

  // Hard stop if connections refuse to close in time.
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();

  const finish = async (): Promise<void> => {
    await disconnectDB();
    logger.info("Server closed");
    process.exit(exitCode);
  };

  // io.close() disconnects every websocket client AND closes the HTTP server.
  // Calling server.close() alone waits forever for open websocket connections.
  try {
    getIO().close(() => {
      void finish();
    });
  } catch {
    server.close(() => {
      void finish();
    });
  }
};

process.on("SIGTERM", () => {
  return shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  return shutdown("SIGINT");
});

process.on("unhandledRejection", (err: unknown) => {
  logger.error(
    `Unhandled Rejection: ${err instanceof Error ? err.message : String(err)}`,
  );
  shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});
