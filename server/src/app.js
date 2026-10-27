import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import gigRoutes from './routes/gigs.js';
import applicationRoutes from './routes/applications.js';
import walletRoutes from './routes/wallet.js';
import disputeRoutes from './routes/disputes.js';
import socialRoutes from './routes/social.js';
import { webhook } from './controllers/paymentController.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render sits behind a proxy; needed for correct rate-limit IPs
  app.use(helmet());
  app.use(cors({ origin: env.clientUrls }));
  // Webhook signature is computed over the exact raw bytes, so parse it before express.json().
  app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '100kb' }), webhook);
  app.use(express.json({ limit: '100kb' }));
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/gigs', gigRoutes);
  app.use('/api/applications', applicationRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/disputes', disputeRoutes);
  app.use('/api', socialRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
