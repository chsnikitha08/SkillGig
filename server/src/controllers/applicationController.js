import mongoose from 'mongoose';
import { Gig } from '../models/Gig.js';
import { Application } from '../models/Application.js';
import { User } from '../models/User.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError.js';
import { scaleAmounts } from '../utils/money.js';
import { notify } from '../services/notificationService.js';
import { gigChanged } from '../services/realtime.js';
import { assertClientOwner, findGigOr404 } from '../services/gigAccess.js';
import { GIG_STATUS, assertGigTransition } from '../services/stateMachine.js';

export async function apply(req, res) {
  const { pitch, quotedPrice } = req.valid.body;
  const gig = await findGigOr404(req.valid.params.id);
  if (gig.status !== GIG_STATUS.OPEN) throw conflict('This gig is no longer accepting applications', 'GIG_CLOSED');
  if (gig.deadline <= new Date()) throw conflict('The deadline for this gig has passed', 'GIG_EXPIRED');
  if (quotedPrice < gig.milestones.length) {
    throw badRequest(`Quote must be at least ${gig.milestones.length} (1 credit per milestone)`);
  }

  let application;
  try {
    application = await Application.create({ gig: gig._id, freelancer: req.user._id, pitch, quotedPrice });
  } catch (err) {
    if (err.code === 11000) throw conflict('You have already applied to this gig', 'ALREADY_APPLIED');
    throw err;
  }
  await Gig.updateOne({ _id: gig._id }, { $inc: { applicationCount: 1 } });
  gigChanged(gig._id);
  notify(gig.client, 'new_application', `${req.user.name} applied to "${gig.title}" for ₹${quotedPrice}`, gig._id);
  res.status(201).json({ application });
}

export async function listForGig(req, res) {
  const gig = await findGigOr404(req.valid.params.id);
  if (req.user.role !== 'admin') assertClientOwner(gig, req.user);
  const applications = await Application.find({ gig: gig._id })
    .sort({ createdAt: 1 })
    .populate('freelancer', 'name skills bio ratingSum ratingCount completedGigs');
  res.json({ applications });
}

export async function withdraw(req, res) {
  const application = await Application.findOneAndUpdate(
    { _id: req.valid.params.id, freelancer: req.user._id, status: 'pending' },
    { status: 'withdrawn' },
    { new: true },
  );
  if (!application) throw notFound('No pending application of yours with that id');
  await Gig.updateOne({ _id: application.gig }, { $inc: { applicationCount: -1 } });
  res.json({ application });
}

/**
 * Client picks a freelancer. In one transaction: the gig moves open -> accepted,
 * the agreed price becomes the quote (milestones re-scaled to match), this
 * application is accepted and every other pending one is rejected.
 */
export async function accept(req, res) {
  let gig;
  let application;
  let rejected = [];
  await mongoose.connection.transaction(async (session) => {
    application = await Application.findById(req.valid.params.id).session(session);
    if (!application) throw notFound('Application not found');
    gig = await findGigOr404(application.gig, { session });
    assertClientOwner(gig, req.user);
    if (application.status !== 'pending') {
      throw conflict(`This application is already ${application.status}`, 'INVALID_STATE');
    }
    assertGigTransition(gig.status, GIG_STATUS.ACCEPTED, 'accept an applicant');

    const freelancer = await User.findById(application.freelancer).session(session);
    if (!freelancer) throw forbidden('That freelancer account no longer exists');

    const amounts = scaleAmounts(gig.milestones.map((m) => m.amount), application.quotedPrice);
    const milestoneUpdates = Object.fromEntries(amounts.map((a, i) => [`milestones.${i}.amount`, a]));

    gig = await Gig.findOneAndUpdate(
      { _id: gig._id, status: GIG_STATUS.OPEN },
      {
        status: GIG_STATUS.ACCEPTED,
        freelancer: application.freelancer,
        agreedAmount: application.quotedPrice,
        acceptedAt: new Date(),
        ...milestoneUpdates,
      },
      { new: true, session },
    );
    if (!gig) throw conflict('Another applicant was accepted at the same moment', 'INVALID_STATE');

    application.status = 'accepted';
    await application.save({ session });
    rejected = await Application.find({ gig: gig._id, status: 'pending' }, 'freelancer', { session });
    await Application.updateMany({ gig: gig._id, status: 'pending' }, { status: 'rejected' }, { session });
  });

  gigChanged(gig._id);
  notify(application.freelancer, 'application_accepted', `You were hired for "${gig.title}". Wait for the client to fund escrow.`, gig._id);
  rejected.forEach((a) => notify(a.freelancer, 'application_rejected', `Another freelancer was chosen for "${gig.title}"`, gig._id));
  res.json({ gig, application });
}
