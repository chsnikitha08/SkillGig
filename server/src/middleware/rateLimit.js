import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { error: { message, code: 'RATE_LIMITED' } },
  });

export const authLimiter = make(15 * 60 * 1000, 20, 'Too many login attempts. Try again in 15 minutes.');
export const moneyLimiter = make(60 * 1000, 30, 'Too many payment requests. Slow down a little.');
