import { Notification } from '../models/Notification.js';

// Set by the Socket.io layer at startup. Stays a no-op in tests and if sockets are off.
let push = () => {};
export const setNotificationPusher = (fn) => {
  push = fn;
};

/**
 * Notifications are best-effort: they are written after the business operation
 * has committed, and a failure here must never undo or fail that operation.
 */
export async function notify(userId, type, message, gigId) {
  try {
    const n = await Notification.create({ user: userId, type, message, gig: gigId });
    push(userId.toString(), n.toJSON());
  } catch (err) {
    console.error('Failed to create notification', err);
  }
}
