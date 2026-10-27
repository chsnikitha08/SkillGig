import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Payment } from '../src/models/Payment.js';
import { Refund } from '../src/models/Refund.js';
import { Transaction } from '../src/models/Transaction.js';
import { retryRefunds } from '../src/services/paymentService.js';
import {
  acceptedGig, api, balanceOf, createAdmin, flush, fundedGig, gateway, gigBody, payForGig, registerUser, resetDb, setup, teardown,
} from './helpers.js';

before(setup);
after(teardown);
beforeEach(resetDb);

const fundUrl = (ctx, step) => `/api/gigs/${ctx.gig._id}/fund/${step}`;

describe('Razorpay funding', () => {
  it('needs an accepted freelancer and the owning client', async () => {
    const c = await registerUser('client');
    const open = (await api().post('/api/gigs').set(c.auth).send(gigBody())).body.gig;
    const res = await api().post(`/api/gigs/${open._id}/fund/order`).set(c.auth);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'NO_FREELANCER');

    const ctx = await acceptedGig({ quote: 2500 });
    const other = await registerUser('client');
    assert.equal((await api().post(fundUrl(ctx, 'order')).set(other.auth)).status, 403);
    assert.equal((await api().post(fundUrl(ctx, 'order')).set(ctx.freelancer.auth)).status, 403);

    const order = await api().post(fundUrl(ctx, 'order')).set(ctx.client.auth);
    assert.equal(order.status, 201);
    assert.equal(order.body.amount, 250000); // paise
    assert.equal(order.body.keyId, 'rzp_test_fake');
    // Re-opening checkout reuses the same order.
    const again = await api().post(fundUrl(ctx, 'order')).set(ctx.client.auth);
    assert.equal(again.body.orderId, order.body.orderId);
  });

  it('verifies the signature and the real payment before funding', async () => {
    const ctx = await acceptedGig({ quote: 3000 });
    const order = (await api().post(fundUrl(ctx, 'order')).set(ctx.client.auth)).body;

    const forged = gateway.pay(order.orderId);
    const bad = await api().post(fundUrl(ctx, 'verify')).set(ctx.client.auth).send({ ...forged, signature: 'a'.repeat(64) });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'BAD_SIGNATURE');

    // Correctly signed, but Razorpay says only ₹1 was paid.
    const underpaid = gateway.pay(order.orderId, { amount: 100 });
    const res = await api().post(fundUrl(ctx, 'verify')).set(ctx.client.auth).send(underpaid);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'PAYMENT_MISMATCH');

    const failed = gateway.pay(order.orderId, { status: 'failed' });
    assert.equal((await api().post(fundUrl(ctx, 'verify')).set(ctx.client.auth).send(failed)).status, 409);

    // Authorized-only payments get captured by the server.
    const ok = gateway.pay(order.orderId, { status: 'authorized' });
    const funded = await api().post(fundUrl(ctx, 'verify')).set(ctx.client.auth).send(ok);
    assert.equal(funded.status, 200);
    assert.equal(funded.body.gig.status, 'in_progress');
    assert.equal(funded.body.gig.escrowHeld, 3000);
    assert.ok(funded.body.gig.milestones.every((m) => m.status === 'funded'));
  });

  it('counts a payment once even if checkout, webhook and sync all report it', async () => {
    const ctx = await acceptedGig({ quote: 3000 });
    const order = (await api().post(fundUrl(ctx, 'order')).set(ctx.client.auth)).body;
    const checkout = gateway.pay(order.orderId);
    const hook = gateway.webhook('payment.captured', checkout.paymentId);

    const results = await Promise.all([
      api().post(fundUrl(ctx, 'verify')).set(ctx.client.auth).send(checkout),
      api().post(fundUrl(ctx, 'verify')).set(ctx.client.auth).send(checkout),
      api().post('/api/payments/webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', hook.signature).send(hook.body),
      api().post(fundUrl(ctx, 'sync')).set(ctx.client.auth),
    ]);
    assert.ok(results.every((r) => r.status === 200), JSON.stringify(results.map((r) => r.body)));
    assert.equal(await Transaction.countDocuments({ type: 'fund' }), 1);
    assert.equal((await balanceOf(ctx.client)).paid, 3000);
  });

  it('webhook alone funds the gig (browser closed after paying), and rejects bad signatures', async () => {
    const ctx = await acceptedGig({ quote: 3000 });
    const order = (await api().post(fundUrl(ctx, 'order')).set(ctx.client.auth)).body;
    const { paymentId } = gateway.pay(order.orderId);
    const hook = gateway.webhook('payment.captured', paymentId);

    const forged = await api().post('/api/payments/webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', 'nope').send(hook.body);
    assert.equal(forged.status, 400);

    const ok = await api().post('/api/payments/webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', hook.signature).send(hook.body);
    assert.equal(ok.status, 200);
    const gig = await api().get(`/api/gigs/${ctx.gig._id}`).set(ctx.client.auth);
    assert.equal(gig.body.gig.status, 'in_progress');
  });

  it('sync recovers a payment whose callback never arrived', async () => {
    const ctx = await acceptedGig({ quote: 3000 });
    const order = (await api().post(fundUrl(ctx, 'order')).set(ctx.client.auth)).body;
    const empty = await api().post(fundUrl(ctx, 'sync')).set(ctx.client.auth);
    assert.equal(empty.body.found, false);
    gateway.pay(order.orderId);
    const res = await api().post(fundUrl(ctx, 'sync')).set(ctx.client.auth);
    assert.equal(res.body.gig.status, 'in_progress');
  });

  it('refunds in full when the gig was cancelled before the payment landed', async () => {
    const ctx = await acceptedGig({ quote: 3000 });
    const order = (await api().post(fundUrl(ctx, 'order')).set(ctx.client.auth)).body;
    await api().post(`/api/gigs/${ctx.gig._id}/cancel`).set(ctx.client.auth);
    const checkout = gateway.pay(order.orderId);
    const res = await api().post(fundUrl(ctx, 'verify')).set(ctx.client.auth).send(checkout);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'PAYMENT_REFUNDED');
    assert.equal(gateway.refunds.length, 1);
    assert.equal(gateway.refunds[0].amount, 300000);
    assert.deepEqual(await balanceOf(ctx.client), { paid: 3000, inEscrow: 0, refunded: 3000, pendingRefunds: 0 });
  });
});

describe('Razorpay refunds from disputes', () => {
  async function disputed() {
    const admin = await createAdmin();
    const ctx = await fundedGig({ quote: 3000 }); // milestones 1000 + 2000
    const ms = ctx.gig.milestones[0]._id;
    await api().post(`/api/gigs/${ctx.gig._id}/milestones/${ms}/submit`).set(ctx.freelancer.auth).send({ note: 'Concepts attached', link: '' });
    const d = await api()
      .post(`/api/gigs/${ctx.gig._id}/milestones/${ms}/dispute`)
      .set(ctx.client.auth)
      .send({ reason: 'The delivered concepts ignore the brief completely.' });
    return { admin, ctx, disputeId: d.body.dispute._id };
  }

  it('a split refunds the client share through Razorpay and pays the rest to the freelancer', async () => {
    const { admin, ctx, disputeId } = await disputed();
    const res = await api()
      .post(`/api/disputes/${disputeId}/resolve`)
      .set(admin.auth)
      .send({ decision: 'split', freelancerAmount: 400, note: 'Partially usable work delivered.' });
    assert.equal(res.status, 200);
    assert.equal(res.body.refunds[0].status, 'processed');
    assert.equal(gateway.refunds[0].amount, 60000);
    assert.equal((await balanceOf(ctx.freelancer)).earnings, 400);
    assert.equal((await balanceOf(ctx.client)).refunded, 600);

    const ledger = await api().get('/api/wallet/transactions').set(ctx.client.auth);
    const refundTx = ledger.body.items.find((t) => t.type === 'refund');
    assert.equal(refundTx.refund.status, 'processed');

    const stats = await api().get('/api/admin/stats').set(admin.auth);
    assert.equal(stats.body.ledger.balanced, true);
    assert.equal(stats.body.ledger.paidIn, 3000);
  });

  it('a Razorpay outage does not undo the decision; the refund is retried', async () => {
    const { admin, ctx, disputeId } = await disputed();
    gateway.failRefunds = true;
    const res = await api().post(`/api/disputes/${disputeId}/resolve`).set(admin.auth).send({ decision: 'refund', note: 'Work did not match brief.' });
    assert.equal(res.status, 200);
    assert.equal(res.body.dispute.status, 'resolved');
    assert.equal(res.body.refunds[0].status, 'failed');
    assert.equal((await balanceOf(ctx.client)).pendingRefunds, 1000);

    const stats = await api().get('/api/admin/stats').set(admin.auth);
    assert.equal(stats.body.failedRefunds.length, 1);

    gateway.failRefunds = false;
    const retry = await api().post(`/api/admin/refunds/${stats.body.failedRefunds[0]._id}/retry`).set(admin.auth);
    assert.equal(retry.body.refund.status, 'processed');
    // Retrying again never sends a second refund.
    await api().post(`/api/admin/refunds/${stats.body.failedRefunds[0]._id}/retry`).set(admin.auth);
    await retryRefunds();
    assert.equal(gateway.refunds.length, 1);
    assert.equal(await Refund.countDocuments({ status: 'processed' }), 1);
    assert.equal((await Payment.findOne({ status: 'paid' })).refundedAmount, 1000);
  });

  it('the background worker retries failed refunds', async () => {
    const { admin, disputeId } = await disputed();
    gateway.failRefunds = true;
    await api().post(`/api/disputes/${disputeId}/resolve`).set(admin.auth).send({ decision: 'refund', note: 'Work did not match brief.' });
    gateway.failRefunds = false;
    await retryRefunds();
    await flush();
    assert.equal((await Refund.findOne()).status, 'processed');
  });
});
