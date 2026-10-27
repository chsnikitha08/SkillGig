import mongoose from 'mongoose';
import { Gig } from '../models/Gig.js';
import { Application } from '../models/Application.js';
import { Review } from '../models/Review.js';
import { Dispute } from '../models/Dispute.js';
import { notFound } from '../utils/AppError.js';
import { notify } from '../services/notificationService.js';
import { gigChanged } from '../services/realtime.js';
import { assertClientOwner, canView, findGigOr404, isParticipant } from '../services/gigAccess.js';
import { GIG_STATUS, assertGigTransition } from '../services/stateMachine.js';

const PUBLIC_USER = 'name role skills ratingSum ratingCount completedGigs';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function createGig(req, res) {
  const { milestones, ...data } = req.valid.body;
  const gig = await Gig.create({
    ...data,
    client: req.user._id,
    milestones: milestones?.length ? milestones : [{ title: 'Full delivery', amount: data.budget }],
  });
  res.status(201).json({ gig });
}

export async function listGigs(req, res) {
  const { q, skill, min, max, dueBefore, sort, page, limit } = req.valid.query;
  const filter = { status: GIG_STATUS.OPEN, deadline: { $gt: new Date() } };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { skillsRequired: rx }];
  }
  if (skill.length) filter.skillsRequired = { $in: skill };
  if (min !== undefined || max !== undefined) {
    filter.budget = {};
    if (min !== undefined) filter.budget.$gte = min;
    if (max !== undefined) filter.budget.$lte = max;
  }
  if (dueBefore) filter.deadline.$lte = dueBefore;

  const sortBy = {
    newest: { createdAt: -1 },
    budget_high: { budget: -1, createdAt: -1 },
    budget_low: { budget: 1, createdAt: -1 },
    deadline: { deadline: 1 },
  }[sort];

  const [items, total] = await Promise.all([
    Gig.find(filter)
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('client', PUBLIC_USER)
      .select('-milestones.submissionNote -milestones.submissionLink'),
    Gig.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function getGig(req, res) {
  const gig = await Gig.findById(req.valid.params.id)
    .populate('client', PUBLIC_USER)
    .populate('freelancer', PUBLIC_USER);
  // 404 rather than 403 for private gigs so their existence isn't leaked.
  if (!gig || !canView(gig, req.user)) throw notFound('Gig not found');

  const extras = {};
  if (req.user.role === 'freelancer') {
    extras.myApplication = await Application.findOne({ gig: gig._id, freelancer: req.user._id });
  }
  if (isParticipant(gig, req.user) || req.user.role === 'admin') {
    [extras.reviews, extras.disputes] = await Promise.all([
      Review.find({ gig: gig._id }).populate('reviewer', 'name'),
      Dispute.find({ gig: gig._id }, 'milestoneId status decision'),
    ]);
  }
  res.json({ gig, ...extras });
}

/** Dashboard data: what the current user is involved in. */
export async function myGigs(req, res) {
  const { role, _id } = req.user;
  if (role === 'client') {
    const gigs = await Gig.find({ client: _id }).sort({ updatedAt: -1 }).populate('freelancer', 'name');
    return res.json({ gigs });
  }
  if (role === 'freelancer') {
    const [gigs, applications] = await Promise.all([
      Gig.find({ freelancer: _id }).sort({ updatedAt: -1 }).populate('client', 'name'),
      Application.find({ freelancer: _id }).sort({ createdAt: -1 }).populate('gig', 'title status budget deadline'),
    ]);
    return res.json({ gigs, applications });
  }
  const gigs = await Gig.find().sort({ updatedAt: -1 }).limit(50).populate('client freelancer', 'name');
  res.json({ gigs });
}

export async function cancelGig(req, res) {
  const id = req.valid.params.id;
  let gig;
  let freelancerId;
  await mongoose.connection.transaction(async (session) => {
    gig = await findGigOr404(id, { session });
    assertClientOwner(gig, req.user);
    if (gig.status === GIG_STATUS.IN_PROGRESS) {
      assertGigTransition(gig.status, GIG_STATUS.CANCELLED, 'cancel after payment; raise a dispute instead');
    }
    assertGigTransition(gig.status, GIG_STATUS.CANCELLED, 'cancel');

    freelancerId = gig.freelancer;
    // Conditional on the status we just checked, so a concurrent "fund" can't slip in between.
    gig = await Gig.findOneAndUpdate(
      { _id: id, status: gig.status },
      { status: GIG_STATUS.CANCELLED, cancelledAt: new Date() },
      { new: true, session },
    );
    if (!gig) throw notFound('Gig changed while cancelling. Refresh and try again.');
    await Application.updateMany(
      { gig: id, status: { $in: ['pending', 'accepted'] } },
      { status: 'rejected' },
      { session },
    );
  });
  gigChanged(gig._id);
  if (freelancerId) notify(freelancerId, 'gig_cancelled', `"${gig.title}" was cancelled by the client`, gig._id);
  res.json({ gig });
}
