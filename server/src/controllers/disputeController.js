import { Dispute } from '../models/Dispute.js';
import { Gig } from '../models/Gig.js';
import { Message } from '../models/Message.js';
import { notFound } from '../utils/AppError.js';
import * as disputes from '../services/disputeService.js';
import { gigChanged } from '../services/realtime.js';

const POP = [
  { path: 'raisedBy', select: 'name role' },
  { path: 'against', select: 'name role' },
  { path: 'resolvedBy', select: 'name' },
];

export async function raise(req, res) {
  const { id, mid } = req.valid.params;
  const result = await disputes.raiseDispute(id, mid, req.user, req.valid.body.reason);
  gigChanged(id);
  res.status(201).json(result);
}

export async function list(req, res) {
  const { status } = req.valid.query;
  const filter = status === 'all' ? {} : { status };
  if (req.user.role !== 'admin') filter.$or = [{ raisedBy: req.user._id }, { against: req.user._id }];
  const items = await Dispute.find(filter).sort({ createdAt: -1 }).populate(POP).populate('gig', 'title');
  res.json({ items });
}

/** Everything an admin needs to decide: both statements, the gig, the submission and the chat. */
export async function getOne(req, res) {
  const dispute = await Dispute.findById(req.valid.params.id).populate(POP);
  const isParty = dispute && [dispute.raisedBy._id, dispute.against._id].some((u) => u.equals(req.user._id));
  if (!dispute || (!isParty && req.user.role !== 'admin')) throw notFound('Dispute not found');

  const [gig, messages] = await Promise.all([
    Gig.findById(dispute.gig).populate('client freelancer', 'name ratingSum ratingCount completedGigs'),
    Message.find({ gig: dispute.gig }).sort({ createdAt: 1 }).limit(200).populate('sender', 'name role'),
  ]);
  res.json({ dispute, gig, milestone: gig.milestones.id(dispute.milestoneId), messages });
}

export async function respond(req, res) {
  const result = await disputes.respondToDispute(req.valid.params.id, req.user, req.valid.body.response);
  res.json(result);
}

export async function resolve(req, res) {
  const result = await disputes.resolveDispute(req.valid.params.id, req.user, req.valid.body);
  gigChanged(result.gig._id);
  res.json(result);
}
