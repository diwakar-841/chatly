import { createLogger, format, transports } from 'winston';

/**
 * Application-wide Winston logger. Uses 'warn' level in production to reduce
 * noise; 'info' everywhere else. Also exposes a `stream.write` method so
 * morgan can pipe HTTP access logs through the same logger.
 */
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) => {
      return stack
        ? `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`
        : `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [new transports.Console()],
});

(logger as typeof logger & { stream: { write: (msg: string) => void } }).stream = {
  write: (message: string) => logger.http(message.trimEnd()),
};

export default logger;
