/**
 * An error that is safe to show to the user. Anything else that reaches the
 * error handler is treated as an unexpected 500 and its details stay in the logs.
 */
export class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg, code = 'BAD_REQUEST') => new AppError(400, msg, code);
export const unauthorized = (msg = 'Please log in to continue', code = 'UNAUTHORIZED') =>
  new AppError(401, msg, code);
export const forbidden = (msg = 'You are not allowed to do this', code = 'FORBIDDEN') =>
  new AppError(403, msg, code);
export const notFound = (msg = 'Not found', code = 'NOT_FOUND') => new AppError(404, msg, code);
export const conflict = (msg, code = 'CONFLICT') => new AppError(409, msg, code);
