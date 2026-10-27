import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { emitToUser } from './realtime.js';

/**
 * Notifications are best-effort: they are written after the business operation
 * has committed, and a failure here must never undo or fail that operation.
 */
const pending = new Set();

export function notify(userId, type, message, gigId) {
  const p = write(userId, type, message, gigId).finally(() => pending.delete(p));
  pending.add(p);
  return p;
}

/** Waits for in-flight notifications (used by scripts before disconnecting). */
export const flushNotifications = () => Promise.all([...pending]);

async function write(userId, type, message, gigId) {
  try {
    const n = await Notification.create({ user: userId, type, message, gig: gigId });
    emitToUser(userId.toString(), 'notification', n.toJSON());
  } catch (err) {
    console.error('Failed to create notification', err);
  }
}

export async function notifyAdmins(type, message, gigId) {
  const admins = await User.find({ role: 'admin' }, '_id');
  await Promise.all(admins.map((a) => notify(a._id, type, message, gigId)));
}
