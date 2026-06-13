import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import 'dotenv/config';

import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import blockRoutes from './routes/blockRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

import { errorHandler, notFound } from './middleware/errorMiddleware.js';
import { generalLimiter } from './middleware/rateLimitMiddleware.js';
import swaggerSpec from './config/swagger.js';
import logger from './utils/logger.js';

interface LoggerWithStream {
  stream: {
    write: (msg: string) => void;
  };
}

const app = express();

/** Parses CLIENT_URL (comma-separated) into an array of allowed CORS origins. */
const getAllowedOrigins = (): string[] =>
  (process.env.CLIENT_URL ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

app.use(helmet());

app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = getAllowedOrigins();
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(
  morgan('combined', {
    stream: (logger as typeof logger & LoggerWithStream).stream,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(mongoSanitize());
app.use(hpp());

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api', generalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/block', blockRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);

/** Simple liveness probe used by load balancers and deployment health checks. */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(notFound);
app.use(errorHandler);

export default app;
