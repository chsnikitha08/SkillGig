import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Transaction } from '../src/models/Transaction.js';
import { acceptedGig, api, balanceOf, fundedGig, registerUser, resetDb, setup, teardown } from './helpers.js';

before(setup);
after(teardown);
beforeEach(resetDb);

const submit = (ctx, i, body = { note: 'Here are the files', link: 'https://drive.example.com/x' }) =>
  api().post(`/api/gigs/${ctx.gig._id}/milestones/${ctx.gig.milestones[i]._id}/submit`).set(ctx.freelancer.auth).send(body);
const approve = (ctx, i, who = ctx.client) =>
  api().post(`/api/gigs/${ctx.gig._id}/milestones/${ctx.gig.milestones[i]._id}/approve`).set(who.auth);

describe('escrow workflow', () => {
  it('runs the full happy path and keeps the ledger consistent', async () => {
    const ctx = await fundedGig({ quote: 2700 });
    assert.equal(ctx.gig.status, 'in_progress');
    assert.equal(ctx.gig.escrowHeld, 2700);
    assert.deepEqual(await balanceOf(ctx.client), { paid: 2700, inEscrow: 2700, refunded: 0, pendingRefunds: 0 });
    assert.deepEqual(await balanceOf(ctx.freelancer), { earnings: 0, inEscrow: 2700 });

    // Can't cancel after funding.
    assert.equal((await api().post(`/api/gigs/${ctx.gig._id}/cancel`).set(ctx.client.auth)).status, 409);
    // Can't approve before submit.
    assert.equal((await approve(ctx, 0)).status, 409);

    assert.equal((await submit(ctx, 0)).status, 200);
    assert.equal((await submit(ctx, 0)).status, 409); // already submitted
    const r1 = await approve(ctx, 0);
    assert.equal(r1.status, 200);
    assert.equal(r1.body.gig.milestones[0].status, 'released');
    assert.equal((await balanceOf(ctx.freelancer)).earnings, 900);

    // Double click: second approve is a safe no-op.
    const dup = await approve(ctx, 0);
    assert.equal(dup.status, 200);
    assert.equal(dup.body.alreadyDone, true);
    assert.equal((await balanceOf(ctx.freelancer)).earnings, 900);

    await submit(ctx, 1);
    const r2 = await approve(ctx, 1);
    assert.equal(r2.body.gig.status, 'completed');
    assert.equal(r2.body.gig.escrowHeld, 0);
    assert.deepEqual(await balanceOf(ctx.freelancer), { earnings: 2700, inEscrow: 0 });

    const ledger = await api().get('/api/wallet/transactions').set(ctx.freelancer.auth);
    assert.deepEqual(ledger.body.items.map((t) => t.type), ['release', 'release']);
    const me = await api().get('/api/auth/me').set(ctx.freelancer.auth);
    assert.equal(me.body.user.completedGigs, 1);
  });

  it('survives concurrent double-approve without paying twice', async () => {
    const ctx = await fundedGig({ quote: 3000 });
    await submit(ctx, 0);
    const approvals = await Promise.all([1, 2, 3].map(() => approve(ctx, 0)));
    assert.ok(approvals.every((r) => r.status === 200 || r.status === 409));
    assert.equal((await balanceOf(ctx.freelancer)).earnings, 1000);
    assert.equal(await Transaction.countDocuments({ type: 'release' }), 1);
  });

  it('enforces who can do what', async () => {
    const ctx = await fundedGig();
    const stranger = await registerUser('freelancer');
    const s = await api()
      .post(`/api/gigs/${ctx.gig._id}/milestones/${ctx.gig.milestones[0]._id}/submit`)
      .set(stranger.auth)
      .send({ note: 'not mine', link: '' });
    assert.equal(s.status, 403);
    assert.equal((await approve(ctx, 0, ctx.freelancer)).status, 403);
    const badMs = await api().post(`/api/gigs/${ctx.gig._id}/milestones/${new mongoose.Types.ObjectId()}/approve`).set(ctx.client.auth);
    assert.equal(badMs.status, 404);
    const badLink = await submit(ctx, 0, { note: 'files here', link: 'javascript:alert(1)' });
    assert.equal(badLink.status, 400);
  });

  it('cannot submit on an unfunded gig', async () => {
    const ctx = await acceptedGig();
    const res = await submit(ctx, 0);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'NOT_FUNDED');
  });

  it('supports revision requests up to a limit', async () => {
    const ctx = await fundedGig();
    const revise = () =>
      api()
        .post(`/api/gigs/${ctx.gig._id}/milestones/${ctx.gig.milestones[0]._id}/revision`)
        .set(ctx.client.auth)
        .send({ note: 'Please use the college colours' });
    for (let i = 0; i < 3; i += 1) {
      await submit(ctx, 0);
      const r = await revise();
      assert.equal(r.body.gig.milestones[0].status, 'funded');
    }
    await submit(ctx, 0);
    const limit = await revise();
    assert.equal(limit.status, 409);
    assert.equal(limit.body.error.code, 'REVISION_LIMIT');
  });

  it('the ledger cannot be edited', async () => {
    await fundedGig();
    await assert.rejects(Transaction.updateOne({}, { amount: 1_000_000 }), /immutable/);
    await assert.rejects(Transaction.deleteMany({}), /immutable/);
  });
});
