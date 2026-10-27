import mongoose from 'mongoose';
import { Dispute } from '../models/Dispute.js';
import { Gig } from '../models/Gig.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError.js';
import { findGigOr404, isClientOf, isParticipant } from './gigAccess.js';
import { findMilestone, settleMilestone } from './escrowService.js';
import { GIG_STATUS, MILESTONE_STATUS as M, assertMilestoneTransition } from './stateMachine.js';
import { notify, notifyAdmins } from './notificationService.js';

const DECISION_TO_STATUS = { release: M.RELEASED, refund: M.REFUNDED, split: M.SPLIT };

/**
 * Either side can dispute submitted work. The client can also dispute work that was
 * never submitted, but only once the deadline has passed (the freelancer vanished).
 */
export async function raiseDispute(gigId, mid, user, reason) {
  let gig;
  let ms;
  let dispute;
  await mongoose.connection.transaction(async (session) => {
    gig = await findGigOr404(gigId, { session });
    if (!isParticipant(gig, user)) throw forbidden('Only the client or freelancer on this gig can raise a dispute');
    if (gig.status !== GIG_STATUS.IN_PROGRESS) throw conflict('Disputes are only possible while a gig is in progress', 'INVALID_STATE');
    ms = findMilestone(gig, mid);
    assertMilestoneTransition(ms.status, M.DISPUTED, 'raise a dispute');

    const byClient = isClientOf(gig, user);
    if (ms.status === M.FUNDED) {
      if (!byClient) throw conflict('Submit your work first; you can dispute it if the client does not respond', 'INVALID_STATE');
      if (gig.deadline > new Date()) {
        throw conflict('You can dispute unsubmitted work only after the deadline has passed', 'DEADLINE_NOT_PASSED');
      }
    }

    const updated = await Gig.findOneAndUpdate(
      { _id: gig._id, milestones: { $elemMatch: { _id: ms._id, status: ms.status } } },
      { $set: { 'milestones.$.status': M.DISPUTED } },
      { new: true, session },
    );
    if (!updated) throw conflict('This milestone changed. Refresh and try again.', 'INVALID_STATE');

    [dispute] = await Dispute.create(
      [
        {
          gig: gig._id,
          milestoneId: ms._id,
          milestoneTitle: ms.title,
          amount: ms.amount,
          raisedBy: user._id,
          against: byClient ? gig.freelancer : gig.client,
          reason,
        },
      ],
      { session },
    );
    gig = updated;
  });

  notify(dispute.against, 'dispute_raised', `${user.name} raised a dispute on "${ms.title}". Add your side of the story.`, gig._id);
  notifyAdmins('dispute_raised', `New dispute on "${gig.title}" (₹${ms.amount})`, gig._id);
  return { gig, dispute };
}

export async function respondToDispute(disputeId, user, response) {
  const dispute = await Dispute.findOneAndUpdate(
    { _id: disputeId, against: user._id, status: 'open', respondedAt: null },
    { response, respondedAt: new Date() },
    { new: true },
  );
  if (!dispute) {
    const existing = await Dispute.findById(disputeId);
    if (!existing) throw notFound('Dispute not found');
    if (!existing.against.equals(user._id)) throw forbidden('Only the other party can respond to this dispute');
    throw conflict(existing.status !== 'open' ? 'This dispute is already resolved' : 'You have already responded', 'INVALID_STATE');
  }
  notifyAdmins('dispute_response', `The other party responded to a dispute on "${dispute.milestoneTitle}"`, dispute.gig);
  return { dispute };
}

export async function resolveDispute(disputeId, admin, { decision, freelancerAmount, note }) {
  let dispute;
  let gig;
  await mongoose.connection.transaction(async (session) => {
    dispute = await Dispute.findById(disputeId).session(session);
    if (!dispute) throw notFound('Dispute not found');
    if (dispute.status !== 'open') throw conflict('This dispute is already resolved', 'ALREADY_RESOLVED');

    gig = await findGigOr404(dispute.gig, { session });
    const ms = findMilestone(gig, dispute.milestoneId);

    let toFreelancer;
    if (decision === 'release') toFreelancer = ms.amount;
    else if (decision === 'refund') toFreelancer = 0;
    else {
      if (!Number.isInteger(freelancerAmount) || freelancerAmount < 1 || freelancerAmount >= ms.amount) {
        throw badRequest(`For a split, the freelancer's share must be between 1 and ${ms.amount - 1}`);
      }
      toFreelancer = freelancerAmount;
    }

    const closed = await Dispute.findOneAndUpdate(
      { _id: dispute._id, status: 'open' },
      {
        status: 'resolved',
        decision,
        freelancerAmount: toFreelancer,
        clientAmount: ms.amount - toFreelancer,
        adminNote: note,
        resolvedBy: admin._id,
        resolvedAt: new Date(),
      },
      { new: true, session },
    );
    if (!closed) throw conflict('This dispute is already resolved', 'ALREADY_RESOLVED');
    dispute = closed;

    gig = await settleMilestone({
      gig,
      ms,
      fromStatus: M.DISPUTED,
      toStatus: DECISION_TO_STATUS[decision],
      toFreelancer,
      session,
      note: `Dispute decision (${decision}) for "${ms.title}"`,
    });
  });

  const msg = `Dispute on "${dispute.milestoneTitle}" resolved: ₹${dispute.freelancerAmount} to freelancer, ₹${dispute.clientAmount} refunded to client.`;
  notify(gig.client, 'dispute_resolved', msg, gig._id);
  notify(gig.freelancer, 'dispute_resolved', msg, gig._id);
  return { dispute, gig };
}
