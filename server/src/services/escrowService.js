/**
 * All money movement lives here. Controllers never touch balances directly.
 *
 * Every operation follows the same pattern inside one MongoDB transaction:
 *   1. load + authorize + check the state machine (gives readable 403/409 errors)
 *   2. conditional write that only matches the expected current state
 *      (so a racing duplicate request matches nothing and aborts)
 *   3. balance change with a guard (e.g. walletBalance >= amount)
 *   4. one append-only ledger entry with a unique key
 * If any step fails the whole transaction rolls back.
 */
import mongoose from 'mongoose';
import { Gig } from '../models/Gig.js';
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError.js';
import { assertAssignedFreelancer, assertClientOwner, findGigOr404 } from './gigAccess.js';
import {
  GIG_STATUS,
  MILESTONE_STATUS as M,
  allMilestonesSettled,
  assertGigTransition,
  assertMilestoneTransition,
} from './stateMachine.js';
import { notify } from './notificationService.js';

export const MAX_TOPUP = 50_000;
export const MAX_REVISIONS = 3;

const runInTransaction = (fn) => mongoose.connection.transaction(fn);

export function findMilestone(gig, mid) {
  const ms = gig.milestones.id(mid);
  if (!ms) throw notFound('Milestone not found');
  return ms;
}

/* ------------------------------------------------------------------ wallet */

export async function topUp(user, amount, idempotencyKey) {
  if (amount > MAX_TOPUP) throw badRequest(`You can add at most ${MAX_TOPUP} credits at a time`);
  const key = idempotencyKey ? `topup:${user._id}:${idempotencyKey}` : `topup:${user._id}:${new mongoose.Types.ObjectId()}`;

  try {
    let updated;
    await runInTransaction(async (session) => {
      await Transaction.create([{ type: 'topup', amount, toUser: user._id, key, note: 'Test credits' }], { session });
      updated = await User.findByIdAndUpdate(user._id, { $inc: { walletBalance: amount } }, { new: true, session });
    });
    return { walletBalance: updated.walletBalance, duplicate: false };
  } catch (err) {
    if (err.code === 11000) {
      // Same Idempotency-Key retried (double click / network retry): don't add money twice.
      const fresh = await User.findById(user._id);
      return { walletBalance: fresh.walletBalance, duplicate: true };
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ fund */

export async function fundGig(gigId, user) {
  let gig;
  let alreadyFunded = false;
  await runInTransaction(async (session) => {
    alreadyFunded = false;
    gig = await findGigOr404(gigId, { session });
    assertClientOwner(gig, user);

    if (gig.fundedAt) {
      alreadyFunded = true; // second click on "Fund": nothing to do
      return;
    }
    if (gig.status === GIG_STATUS.OPEN) {
      throw conflict('Accept a freelancer before funding escrow', 'NO_FREELANCER');
    }
    assertGigTransition(gig.status, GIG_STATUS.IN_PROGRESS, 'fund escrow');

    const amount = gig.agreedAmount;
    const debited = await User.findOneAndUpdate(
      { _id: user._id, walletBalance: { $gte: amount } },
      { $inc: { walletBalance: -amount } },
      { new: true, session },
    );
    if (!debited) {
      const current = await User.findById(user._id).session(session);
      throw badRequest(
        `Insufficient balance: funding needs ${amount} credits but you have ${current.walletBalance}. Top up your wallet first.`,
        'INSUFFICIENT_FUNDS',
      );
    }

    gig = await Gig.findOneAndUpdate(
      { _id: gig._id, status: GIG_STATUS.ACCEPTED },
      {
        $set: { status: GIG_STATUS.IN_PROGRESS, escrowHeld: amount, fundedAt: new Date(), 'milestones.$[].status': M.FUNDED },
      },
      { new: true, session },
    );
    if (!gig) throw conflict('Gig changed while funding. Refresh and try again.', 'INVALID_STATE');

    await Transaction.create(
      [{ type: 'fund', amount, fromUser: user._id, gig: gig._id, key: `fund:${gig._id}`, note: `Escrow for "${gig.title}"` }],
      { session },
    );
  });

  if (!alreadyFunded) {
    notify(gig.freelancer, 'gig_funded', `Funds secured: ₹${gig.agreedAmount} are in escrow for "${gig.title}". You can start working.`, gig._id);
  }
  return { gig, alreadyDone: alreadyFunded };
}

/* ------------------------------------------------------------------ submit / revise */

export async function submitMilestone(gigId, mid, user, { note, link }) {
  const gig = await findGigOr404(gigId);
  assertAssignedFreelancer(gig, user);
  if (gig.status !== GIG_STATUS.IN_PROGRESS) {
    throw conflict(`Cannot submit work: the gig is ${gig.status.replace('_', ' ')}, not funded`, 'NOT_FUNDED');
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
  if (!updated) throw conflict('This milestone changed while submitting. Refresh and try again.', 'INVALID_STATE');
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
  if (!updated) throw conflict('This milestone changed. Refresh and try again.', 'INVALID_STATE');
  notify(gig.freelancer, 'revision_requested', `Changes requested on "${ms.title}": ${note}`, gig._id);
  return { gig: updated };
}

/* ------------------------------------------------------------------ settle */

/**
 * Moves a milestone's escrowed amount out: `toFreelancer` to the freelancer's wallet,
 * the rest back to the client. Used by client approval and by admin dispute decisions.
 * Must be called inside a transaction. Returns the updated gig.
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
  if (!updated) throw conflict('This milestone was already settled', 'ALREADY_SETTLED');

  const entries = [];
  if (toFreelancer > 0) {
    await User.updateOne({ _id: gig.freelancer }, { $inc: { walletBalance: toFreelancer } }, { session });
    entries.push({ type: 'release', amount: toFreelancer, toUser: gig.freelancer, key: `release:${ms._id}` });
  }
  if (toClient > 0) {
    await User.updateOne({ _id: gig.client }, { $inc: { walletBalance: toClient } }, { session });
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
  return updated;
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
    assertMilestoneTransition(ms.status, M.RELEASED, 'approve and release payment');
    if (ms.status !== M.SUBMITTED) throw conflict('Work must be submitted before it can be approved', 'INVALID_STATE');
    gig = await settleMilestone({ gig, ms, fromStatus: M.SUBMITTED, toStatus: M.RELEASED, toFreelancer: ms.amount, session });
  });

  if (!alreadyDone) {
    notify(gig.freelancer, 'payment_released', `₹${ms.amount} released to your wallet for "${ms.title}"`, gig._id);
    if (gig.status === GIG_STATUS.COMPLETED) {
      notify(gig.freelancer, 'gig_completed', `"${gig.title}" is complete. Leave a review for the client.`, gig._id);
      notify(gig.client, 'gig_completed', `"${gig.title}" is complete. Leave a review for the freelancer.`, gig._id);
    }
  }
  return { gig, alreadyDone };
}
