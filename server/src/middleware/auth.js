import { User } from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';
import { forbidden, unauthorized } from '../utils/AppError.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized());

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(unauthorized('Your session has expired. Please log in again.', 'TOKEN_INVALID'));
  }
  // Load the user on each request so deleted users and role changes take effect immediately.
  const user = await User.findById(payload.sub);
  if (!user) return next(unauthorized('Account no longer exists', 'TOKEN_INVALID'));
  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(forbidden(`Only ${roles.join(' or ')} accounts can do this`, 'WRONG_ROLE'));
  }
  next();
};
