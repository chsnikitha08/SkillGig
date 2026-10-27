import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.originalUrl} not found`, code: 'NOT_FOUND' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code } });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { message: `Invalid ${err.path}`, code: 'INVALID_ID' } });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: { message: 'This already exists', code: 'DUPLICATE' } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Malformed JSON body', code: 'BAD_JSON' } });
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong on our side. Please try again.', code: 'SERVER_ERROR' } });
}
