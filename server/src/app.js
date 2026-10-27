import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render sits behind a proxy; needed for correct rate-limit IPs
  app.use(helmet());
  app.use(cors({ origin: env.clientUrls }));
  app.use(express.json({ limit: '100kb' }));
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
