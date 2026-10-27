/**
 * Money in (Razorpay payment -> gig escrow) and money back out to clients
 * (Razorpay refunds).
 *
 * Funding flow:
 *   1. createFundingOrder: server creates a Razorpay order for exactly the agreed price.
 *   2. Browser opens Razorpay Checkout; on success it gets payment_id + signature.
 *   3. verifyCheckout: server checks the signature AND fetches the payment from
 *      Razorpay (amount, order, status) before trusting it.
 *   4. confirmFunding: one transaction marks the payment paid, moves the gig to
 *      in_progress, and writes the ledger entry.
 * The webhook and syncFunding call the same idempotent confirmFunding, so a payment
 * is never lost if the browser closes after paying, and never counted twice.
 */
import mongoose from 'mongoose';
import { Gig } from '../models/Gig.js';
import { Payment } from '../models/Payment.js';
import { Refund } from '../models/Refund.js';
import { Transaction } from '../models/Transaction.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';
import { getGateway } from './paymentGateway.js';
import { assertClientOwner, findGigOr404 } from './gigAccess.js';
import { GIG_STATUS, MILESTONE_STATUS as M } from './stateMachine.js';
import { notify } from './notificationService.js';
import { gigChanged } from './realtime.js';

const PAISE = 100;
const ORDER_REUSE_MS = 30 * 60 * 1000;

/* ---------------------------------------------------------------- 1. order */

export async function createFundingOrder(gigId, user) {
  const gig = await findGigOr404(gigId);
  assertClientOwner(gig, user);
  if (gig.status === GIG_STATUS.OPEN) throw conflict('Hire a freelancer before paying', 'NO_FREELANCER');
  if (gig.status !== GIG_STATUS.ACCEPTED) {
    throw conflict(gig.status === GIG_STATUS.IN_PROGRESS ? 'This gig is already paid for' : `This gig can't be paid for because it is ${gig.status.replace('_', ' ')}`, 'INVALID_STATE');
  }

  const gateway = getGateway();
  // Re-opening checkout (or a double click) reuses the same recent order instead of creating many.
  let payment = await Payment.findOne({
    gig: gig._id,
    status: 'created',
    amount: gig.agreedAmount,
    createdAt: { $gt: new Date(Date.now() - ORDER_REUSE_MS) },
  });
  if (!payment) {
    const order = await gateway.createOrder({
      amount: gig.agreedAmount * PAISE,
      receipt: `gig_${gig._id}`.slice(0, 40),
      notes: { gigId: gig._id.toString(), clientId: user._id.toString() },
    });
    payment = await Payment.create({ gig: gig._id, client: user._id, orderId: order.id, amount: gig.agreedAmount });
  }
  return {
    keyId: gateway.keyId,
    orderId: payment.orderId,
    amount: payment.amount * PAISE,
    currency: 'INR',
    gig: { id: gig._id, title: gig.title },
    prefill: { name: user.name, email: user.email },
  };
}

/* ---------------------------------------------------------------- 2. verify */

/** Asks Razorpay for the real payment state; never trust what the browser says. */
async function fetchVerifiedPayment(payment, razorpayPaymentId) {
  const gateway = getGateway();
  let rp = await gateway.fetchPayment(razorpayPaymentId);
  if (rp.order_id !== payment.orderId) throw badRequest('Payment does not belong to this order', 'PAYMENT_MISMATCH');
  if (rp.amount !== payment.amount * PAISE || rp.currency !== 'INR') {
    throw badRequest('The paid amount does not match the gig price', 'PAYMENT_MISMATCH');
  }
  if (rp.status === 'authorized') rp = await gateway.capture(rp.id, rp.amount);
  if (rp.status !== 'captured') throw conflict(`Payment is ${rp.status}, not completed`, 'PAYMENT_NOT_CAPTURED');
  return rp;
}

export async function verifyCheckout(gigId, user, { orderId, paymentId, signature }) {
  const payment = await Payment.findOne({ orderId, gig: gigId });
  if (!payment) throw notFound('Payment order not found for this gig');
  if (!payment.client.equals(user._id)) throw notFound('Payment order not found for this gig');
  if (!getGateway().verifyPaymentSignature({ orderId, paymentId, signature })) {
    throw badRequest('Payment signature is invalid', 'BAD_SIGNATURE');
  }
  await fetchVerifiedPayment(payment, paymentId);
  const result = await confirmFunding(payment._id, paymentId);
  if (result.refunded) throw conflict('This gig is no longer available, so your payment is being refunded in full', 'PAYMENT_REFUNDED');
  return result;
}

/**
 * Recovery path when the checkout callback never reached us (tab closed, network
 * dropped): ask Razorpay for captured payments on this gig's open orders.
 */
export async function syncFunding(gigId, user) {
  const gig = await findGigOr404(gigId);
  assertClientOwner(gig, user);
  const open = await Payment.find({ gig: gig._id, status: 'created' });
  let result = null;
  for (const payment of open) {
    const items = await getGateway().fetchOrderPayments(payment.orderId);
    const done = items.find((p) => ['captured', 'authorized'].includes(p.status));
    if (done) {
      await fetchVerifiedPayment(payment, done.id);
      result = await confirmFunding(payment._id, done.id);
    }
  }
  return result ?? { gig: await Gig.findById(gig._id), alreadyDone: false, found: false };
}

/* ---------------------------------------------------------------- webhook */

export async function handleWebhook(rawBody, signature) {
  if (!getGateway().verifyWebhookSignature(rawBody, signature)) throw badRequest('Invalid webhook signature', 'BAD_SIGNATURE');
  const event = JSON.parse(rawBody.toString('utf8'));
  if (!['payment.captured', 'order.paid'].includes(event.event)) return { ignored: event.event };

  const rp = event.payload?.payment?.entity;
  if (!rp?.order_id) return { ignored: 'no order' };
  const payment = await Payment.findOne({ orderId: rp.order_id });
  if (!payment) return { ignored: 'unknown order' };
  if (rp.amount !== payment.amount * PAISE) return { ignored: 'amount mismatch' };
  await confirmFunding(payment._id, rp.id);
  return { ok: true };
}

/* ---------------------------------------------------------------- 3. confirm */

/**
 * Idempotent: safe to call from the checkout callback, the webhook and sync at the
 * same time. Exactly one caller wins the created -> paid update; the rest see
 * alreadyDone. If the gig can no longer be funded (cancelled meanwhile, or already
 * funded by another order), the payment is refunded in full instead.
 */
export async function confirmFunding(paymentDocId, razorpayPaymentId) {
  let gig;
  let payment;
  let alreadyDone = false;
  let surplusRefund = null;

  await mongoose.connection.transaction(async (session) => {
    alreadyDone = false;
    surplusRefund = null;
    payment = await Payment.findOneAndUpdate(
      { _id: paymentDocId, status: 'created' },
      { status: 'paid', paymentId: razorpayPaymentId, paidAt: new Date() },
      { new: true, session },
    );
    if (!payment) {
      payment = await Payment.findById(paymentDocId).session(session);
      gig = await Gig.findById(payment.gig).session(session);
      alreadyDone = true;
      return;
    }

    await Transaction.create(
      [
        {
          type: 'fund',
          amount: payment.amount,
          fromUser: payment.client,
          gig: payment.gig,
          key: `fund:${payment._id}`,
          note: `Razorpay payment ${razorpayPaymentId}`,
        },
      ],
      { session },
    );

    gig = await Gig.findOneAndUpdate(
      { _id: payment.gig, status: GIG_STATUS.ACCEPTED, agreedAmount: payment.amount },
      {
        $set: {
          status: GIG_STATUS.IN_PROGRESS,
          escrowHeld: payment.amount,
          payment: payment._id,
          fundedAt: new Date(),
          'milestones.$[].status': M.FUNDED,
        },
      },
      { new: true, session },
    );

    if (!gig) {
      // Money arrived but the gig can't take it: return all of it.
      gig = await Gig.findById(payment.gig).session(session);
      payment.surplus = true;
      await payment.save({ session });
      [surplusRefund] = await Refund.create(
        [
          {
            payment: payment._id,
            gig: payment.gig,
            client: payment.client,
            amount: payment.amount,
            reason: 'Gig could not be funded (cancelled or already funded)',
            key: `refund:surplus:${payment._id}`,
          },
        ],
        { session },
      );
      await Transaction.create(
        [{ type: 'refund', amount: payment.amount, toUser: payment.client, gig: payment.gig, key: `refund:surplus:${payment._id}`, note: 'Automatic full refund' }],
        { session },
      );
    }
  });

  if (surplusRefund) {
    await processRefund(surplusRefund._id);
    notify(payment.client, 'payment_refunded', `Your payment of ₹${payment.amount} for "${gig.title}" was refunded because the gig is no longer available.`, gig._id);
    return { gig, alreadyDone: false, refunded: true };
  }
  if (!alreadyDone) {
    gigChanged(gig._id);
    notify(gig.freelancer, 'gig_funded', `Payment secured for "${gig.title}". You can start working; you'll be paid as each part is approved.`, gig._id);
    notify(gig.client, 'payment_received', `Payment of ₹${payment.amount} for "${gig.title}" was successful. It's held safely until you approve the work.`, gig._id);
  }
  return { gig, alreadyDone };
}

/* ---------------------------------------------------------------- refunds */

/**
 * Sends one queued refund to Razorpay. The conditional status update means two
 * workers can never send the same refund. Failures are recorded and retried later.
 */
export async function processRefund(refundId) {
  const refund = await Refund.findOneAndUpdate(
    { _id: refundId, status: { $in: ['pending', 'failed'] } },
    { status: 'processing', $inc: { attempts: 1 } },
    { new: true },
  );
  if (!refund) return Refund.findById(refundId);

  const payment = await Payment.findById(refund.payment);
  try {
    const rr = await getGateway().refund(payment.paymentId, {
      amount: refund.amount * PAISE,
      receipt: `rf_${refund._id}`,
      notes: { gigId: refund.gig.toString(), reason: refund.reason.slice(0, 200) },
    });
    await Payment.updateOne({ _id: payment._id }, { $inc: { refundedAmount: refund.amount } });
    return await Refund.findByIdAndUpdate(
      refund._id,
      { status: 'processed', razorpayRefundId: rr.id, processedAt: new Date(), lastError: null },
      { new: true },
    );
  } catch (err) {
    console.error(`Refund ${refund._id} failed:`, err.message);
    return Refund.findByIdAndUpdate(refund._id, { status: 'failed', lastError: err.message }, { new: true });
  }
}

/** Background job: retry failed refunds and recover ones stuck mid-call after a crash. */
export async function retryRefunds() {
  const stale = new Date(Date.now() - 5 * 60 * 1000);
  await Refund.updateMany({ status: 'processing', updatedAt: { $lt: stale } }, { status: 'failed', lastError: 'Interrupted' });
  const due = await Refund.find({ status: { $in: ['pending', 'failed'] }, attempts: { $lt: 10 } }).limit(20);
  for (const r of due) await processRefund(r._id);
  return due.length;
}

export function startRefundWorker(intervalMs = 5 * 60 * 1000) {
  const tick = () => retryRefunds().catch((err) => console.error('Refund worker error', err));
  tick();
  return setInterval(tick, intervalMs);
}
