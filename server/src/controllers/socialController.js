import { Gig } from '../models/Gig.js';
import { Message } from '../models/Message.js';
import { Notification } from '../models/Notification.js';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { conflict, notFound } from '../utils/AppError.js';
import { isParticipant } from '../services/gigAccess.js';
import { leaveReview } from '../services/ratingService.js';
import { emitToGig } from '../services/realtime.js';
import { notify } from '../services/notificationService.js';
import { GIG_STATUS } from '../services/stateMachine.js';


export async function review(req, res) {
  res.status(201).json(await leaveReview(req.valid.params.id, req.user, req.valid.body));
}


export async function profile(req, res) {
  const user = await User.findById(req.valid.params.id).select('name role bio skills ratingSum ratingCount completedGigs createdAt');
  if (!user || user.role === 'admin') throw notFound('User not found');
  const reviews = await Review.find({ reviewee: user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('reviewer', 'name')
    .populate('gig', 'title');
  res.json({ user, reviews });
}


async function chatGig(req) {
  const gig = await Gig.findById(req.valid.params.id);
  const allowed = gig && (isParticipant(gig, req.user) || req.user.role === 'admin');
  if (!allowed) throw notFound('Gig not found');
  if (!gig.freelancer) throw conflict('Chat opens once a freelancer has been accepted', 'CHAT_CLOSED');
  return gig;
}

export async function listMessages(req, res) {
  const gig = await chatGig(req);
  const messages = await Message.find({ gig: gig._id }).sort({ createdAt: 1 }).limit(500).populate('sender', 'name role');
  res.json({ messages });
}

export async function sendMessage(req, res) {
  const gig = await chatGig(req);
  if (gig.status === GIG_STATUS.CANCELLED) throw conflict('This gig was cancelled', 'CHAT_CLOSED');
  const message = await Message.create({ gig: gig._id, sender: req.user._id, text: req.valid.body.text });
  await message.populate('sender', 'name role');
  emitToGig(gig._id.toString(), 'chat:message', message.toJSON());
  const others = [gig.client, gig.freelancer].filter((u) => !u.equals(req.user._id));
  others.forEach((u) => notify(u, 'chat_message', `New message from ${req.user.name} on "${gig.title}"`, gig._id));
  res.status(201).json({ message });
}


export async function listNotifications(req, res) {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ items, unread });
}

export async function markAllRead(req, res) {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ unread: 0 });
}
