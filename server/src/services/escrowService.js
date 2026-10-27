/**
 * All money movement lives here. Controllers never touch balances directly.
 *
 * Funding (money in from Razorpay) is in paymentService; this file covers what
 * happens to escrow afterwards. Every operation follows the same pattern inside
 * one MongoDB transaction:
 *   1. load + authorize + check the state machine (gives readable 403/409 errors)
 *   2. conditional write that only matches the expected current state
 *      (so a racing duplicate request matches nothing and aborts)
 *   3. balance change (freelancer earnings) or a queued Razorpay refund
 *   4. one append-only ledger entry with a unique key
 * If any step fails the whole transaction rolls back.
 */
import mongoose from 'mongoose';
import { Gig } from '../models/Gig.js';
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { Payment } from '../models/Payment.js';
import { Refund } from '../models/Refund.js';
import { conflict, forbidden, notFound } from '../utils/AppError.js';
import { assertAssignedFreelancer, assertClientOwner, findGigOr404 } from './gigAccess.js';
import {
  GIG_STATUS,
  MILESTONE_STATUS as M,
  allMilestonesSettled,
  assertGigTransition,
  assertMilestoneTransition,
} from './stateMachine.js';
import { notify } from './notificationService.js';

export const MAX_REVISIONS = 3;

const runInTransaction = (fn) => mongoose.connection.transaction(fn);

export function findMilestone(gig, mid) {
  const ms = gig.milestones.id(mid);
  if (!ms) throw notFound('This stage of the project was not found');
  return ms;
}

/* ------------------------------------------------------------------ submit / revise */

export async function submitMilestone(gigId, mid, user, { note, link }) {
  const gig = await findGigOr404(gigId);
  assertAssignedFreelancer(gig, user);
  if (gig.status !== GIG_STATUS.IN_PROGRESS) {
    throw conflict('You can submit work once the client has completed the payment', 'NOT_FUNDED');
  }
  const ms = findMilestone(gig, mid);
  assertMilestoneTransition(ms.status, M.SUBMITTED, 'submit work');

  const updated = await Gig.findOneAndUpdate(
    { _id: gig._id, status: GIG_STATUS.IN_PROGRESS, milestones: { $elemMatch: { _id: ms._id, status: M.FUNDED } } },
    {
      $set: {
        'milestones.$.status': M.SUBMITTED,
        'milestones.$.submissionNote': note,
        'milestones.$.submissionLink': link,
        'milestones.$.submittedAt': new Date(),
      },
    },
    { new: true },
  );
  if (!updated) throw conflict('This changed while you were submitting. Refresh and try again.', 'INVALID_STATE');
  notify(gig.client, 'work_submitted', `Work submitted for "${ms.title}" on "${gig.title}". Review and approve it.`, gig._id);
  return { gig: updated };
}

export async function requestRevision(gigId, mid, user, { note }) {
  const gig = await findGigOr404(gigId);
  assertClientOwner(gig, user);
  const ms = findMilestone(gig, mid);
  assertMilestoneTransition(ms.status, M.FUNDED, 'request changes');
  if (ms.status !== M.SUBMITTED) throw conflict('Can only request changes on submitted work', 'INVALID_STATE');
  if (ms.revisionCount >= MAX_REVISIONS) {
    throw conflict(`You already asked for ${MAX_REVISIONS} revisions. Approve the work or raise a dispute.`, 'REVISION_LIMIT');
  }

  const updated = await Gig.findOneAndUpdate(
    { _id: gig._id, milestones: { $elemMatch: { _id: ms._id, status: M.SUBMITTED } } },
    { $set: { 'milestones.$.status': M.FUNDED, 'milestones.$.revisionNote': note }, $inc: { 'milestones.$.revisionCount': 1 } },
    { new: true },
  );
  if (!updated) throw conflict('This changed in the meantime. Refresh and try again.', 'INVALID_STATE');
  notify(gig.freelancer, 'revision_requested', `Changes requested on "${ms.title}": ${note}`, gig._id);
  return { gig: updated };
}

/* ------------------------------------------------------------------ settle */

/**
 * Moves a milestone's escrowed amount out: `toFreelancer` to the freelancer's earnings,
 * the rest back to the client as a Razorpay refund on the original payment. Used by
 * client approval and by admin dispute decisions. Must be called inside a transaction.
 * Returns the updated gig and any refunds queued (process them after commit).
 */
export async function settleMilestone({ gig, ms, fromStatus, toStatus, toFreelancer, session, note }) {
  const toClient = ms.amount - toFreelancer;
  const now = new Date();

  let updated = await Gig.findOneAndUpdate(
    {
      _id: gig._id,
      escrowHeld: { $gte: ms.amount },
      milestones: { $elemMatch: { _id: ms._id, status: fromStatus } },
    },
    {
      $set: {
        'milestones.$.status': toStatus,
        'milestones.$.releasedAmount': toFreelancer,
        'milestones.$.refundedAmount': toClient,
        'milestones.$.settledAt': now,
      },
      $inc: { escrowHeld: -ms.amount },
    },
    { new: true, session },
  );
  if (!updated) throw conflict('This has already been paid out', 'ALREADY_SETTLED');

  const entries = [];
  if (toFreelancer > 0) {
    await User.updateOne({ _id: gig.freelancer }, { $inc: { walletBalance: toFreelancer } }, { session });
    entries.push({ type: 'release', amount: toFreelancer, toUser: gig.freelancer, key: `release:${ms._id}` });
  }
  const refunds = [];
  if (toClient > 0) {
    const payment = await Payment.findOne({ _id: gig.payment, status: 'paid' }).session(session);
    if (!payment) throw conflict('No completed payment was found to refund for this gig', 'NO_PAYMENT');
    const [refund] = await Refund.create(
      [
        {
          payment: payment._id,
          gig: gig._id,
          client: gig.client,
          milestoneId: ms._id,
          amount: toClient,
          reason: note || `Refund for "${ms.title}"`,
          key: `refund:${ms._id}`,
        },
      ],
      { session },
    );
    refunds.push(refund);
    entries.push({ type: 'refund', amount: toClient, toUser: gig.client, key: `refund:${ms._id}` });
  }
  await Transaction.create(
    entries.map((e) => ({ ...e, gig: gig._id, milestoneId: ms._id, note: note || `"${ms.title}" on "${gig.title}"` })),
    { session, ordered: true },
  );

  if (allMilestonesSettled(updated.milestones)) {
    assertGigTransition(updated.status, GIG_STATUS.COMPLETED, 'complete the gig');
    updated = await Gig.findOneAndUpdate(
      { _id: gig._id, status: GIG_STATUS.IN_PROGRESS },
      { status: GIG_STATUS.COMPLETED, completedAt: now },
      { new: true, session },
    );
    await User.updateOne({ _id: gig.freelancer }, { $inc: { completedGigs: 1 } }, { session });
  }
  return { gig: updated, refunds };
}

export async function approveMilestone(gigId, mid, user) {
  let gig;
  let ms;
  let alreadyDone = false;
  await runInTransaction(async (session) => {
    alreadyDone = false;
    gig = await findGigOr404(gigId, { session });
    if (gig.freelancer?.equals(user._id)) throw forbidden('You cannot approve your own work', 'SELF_APPROVAL');
    assertClientOwner(gig, user);
    ms = findMilestone(gig, mid);
    if (ms.status === M.RELEASED) {
      alreadyDone = true; // double click on "Approve": money already released once
      return;
    }
    assertMilestoneTransition(ms.status, M.RELEASED, 'approve and pay');
    if (ms.status !== M.SUBMITTED) throw conflict('Work must be submitted before it can be approved', 'INVALID_STATE');
    ({ gig } = await settleMilestone({ gig, ms, fromStatus: M.SUBMITTED, toStatus: M.RELEASED, toFreelancer: ms.amount, session }));
  });

  if (!alreadyDone) {
    notify(gig.freelancer, 'payment_released', `You've been paid ₹${ms.amount} for "${ms.title}"`, gig._id);
    if (gig.status === GIG_STATUS.COMPLETED) {
      notify(gig.freelancer, 'gig_completed', `"${gig.title}" is complete. Leave a review for the client.`, gig._id);
      notify(gig.client, 'gig_completed', `"${gig.title}" is complete. Leave a review for the freelancer.`, gig._id);
    }
  }
  return { gig, alreadyDone };
}
