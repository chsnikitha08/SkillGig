import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Gig } from '../src/models/Gig.js';
import { acceptedGig, api, balanceOf, createAdmin, fundedGig, registerUser, resetDb, setup, teardown } from './helpers.js';

before(setup);
after(teardown);
beforeEach(resetDb);

const msUrl = (ctx, i, action) => `/api/gigs/${ctx.gig._id}/milestones/${ctx.gig.milestones[i]._id}/${action}`;
const submit = (ctx, i) => api().post(msUrl(ctx, i, 'submit')).set(ctx.freelancer.auth).send({ note: 'Done, see link', link: 'https://x.dev/a' });
const reason = { reason: 'The client has not responded to my submission for a week.' };

describe('disputes', () => {
  it('freelancer disputes submitted work, other side responds, admin splits', async () => {
    const admin = await createAdmin();
    const ctx = await fundedGig(); // 1000 + 2000 paid via (fake) Razorpay
    await submit(ctx, 0);

    const raised = await api().post(msUrl(ctx, 0, 'dispute')).set(ctx.freelancer.auth).send(reason);
    assert.equal(raised.status, 201);
    assert.equal(raised.body.gig.milestones[0].status, 'disputed');
    // Can't approve or dispute again while disputed.
    assert.equal((await api().post(msUrl(ctx, 0, 'approve')).set(ctx.client.auth)).status, 409);
    assert.equal((await api().post(msUrl(ctx, 0, 'dispute')).set(ctx.client.auth).send(reason)).status, 409);

    const id = raised.body.dispute._id;
    assert.equal((await api().post(`/api/disputes/${id}/respond`).set(ctx.freelancer.auth).send({ response: 'I raised it myself' })).status, 403);
    const resp = await api().post(`/api/disputes/${id}/respond`).set(ctx.client.auth).send({ response: 'The concepts did not match the brief.' });
    assert.equal(resp.status, 200);

    // Only admins resolve; split must be strictly between 0 and the amount.
    const resolve = (body, who = admin) => api().post(`/api/disputes/${id}/resolve`).set(who.auth).send(body);
    assert.equal((await resolve({ decision: 'release', note: 'I decide myself' }, ctx.client)).status, 403);
    assert.equal((await resolve({ decision: 'split', freelancerAmount: 1000, note: 'Half and half is fair' })).status, 400);

    const detail = await api().get(`/api/disputes/${id}`).set(admin.auth);
    assert.equal(detail.body.milestone.submissionLink, 'https://x.dev/a');

    const done = await resolve({ decision: 'split', freelancerAmount: 600, note: 'Partial work delivered, 60/40.' });
    assert.equal(done.status, 200);
    assert.equal(done.body.gig.milestones[0].status, 'split');
    assert.equal((await resolve({ decision: 'refund', note: 'Changed my mind here' })).status, 409);

    assert.equal((await balanceOf(ctx.freelancer)).earnings, 600);
    assert.equal((await balanceOf(ctx.client)).refunded, 400);

    const stats = await api().get('/api/admin/stats').set(admin.auth);
    assert.equal(stats.body.ledger.balanced, true);
    assert.equal(stats.body.ledger.inEscrow, 2000);
  });

  it('client can dispute unsubmitted work only after the deadline, then get a refund', async () => {
    const admin = await createAdmin();
    const ctx = await fundedGig({ quote: 3000 });
    const early = await api().post(msUrl(ctx, 1, 'dispute')).set(ctx.client.auth).send(reason);
    assert.equal(early.status, 409);
    assert.equal(early.body.error.code, 'DEADLINE_NOT_PASSED');
    // Freelancer can't dispute their own unsubmitted milestone.
    assert.equal((await api().post(msUrl(ctx, 1, 'dispute')).set(ctx.freelancer.auth).send(reason)).status, 409);

    await Gig.updateOne({ _id: ctx.gig._id }, { deadline: new Date(Date.now() - 1000) });
    const raised = await api().post(msUrl(ctx, 1, 'dispute')).set(ctx.client.auth).send(reason);
    assert.equal(raised.status, 201);
    await api().post(`/api/disputes/${raised.body.dispute._id}/resolve`).set(admin.auth).send({ decision: 'refund', note: 'Freelancer never delivered.' });
    assert.equal((await balanceOf(ctx.client)).refunded, 2000);

    // Settle the other milestone; the gig completes even with one refund.
    await submit(ctx, 0);
    const last = await api().post(msUrl(ctx, 0, 'approve')).set(ctx.client.auth);
    assert.equal(last.body.gig.status, 'completed');
  });

  it('only participants see a dispute', async () => {
    const ctx = await fundedGig();
    await submit(ctx, 0);
    const raised = await api().post(msUrl(ctx, 0, 'dispute')).set(ctx.client.auth).send(reason);
    const stranger = await registerUser('client');
    assert.equal((await api().get(`/api/disputes/${raised.body.dispute._id}`).set(stranger.auth)).status, 404);
    assert.equal((await api().get('/api/disputes').set(stranger.auth)).body.items.length, 0);
    assert.equal((await api().get('/api/disputes').set(ctx.freelancer.auth)).body.items.length, 1);
  });
});

describe('reviews', () => {
  it('both sides review once after completion and the average updates', async () => {
    const ctx = await fundedGig({ gig: { milestones: undefined }, quote: 3000 });
    const review = (who, rating) => api().post(`/api/gigs/${ctx.gig._id}/review`).set(who.auth).send({ rating, comment: 'Great' });
    assert.equal((await review(ctx.client, 5)).status, 409); // not completed yet
    await submit(ctx, 0);
    await api().post(msUrl(ctx, 0, 'approve')).set(ctx.client.auth);

    assert.equal((await review(ctx.client, 4)).status, 201);
    assert.equal((await review(ctx.client, 4)).status, 409);
    assert.equal((await review(ctx.freelancer, 5)).status, 201);
    assert.equal((await api().post(`/api/gigs/${ctx.gig._id}/review`).set(ctx.client.auth).send({ rating: 9 })).status, 400);

    const profile = await api().get(`/api/users/${ctx.freelancer.user._id}`).set(ctx.client.auth);
    assert.equal(profile.body.user.ratingAvg, 4);
    assert.equal(profile.body.user.completedGigs, 1);
    assert.equal(profile.body.reviews.length, 1);
  });
});

describe('chat and notifications', () => {
  it('only participants chat, and messages notify the other side', async () => {
    const ctx = await acceptedGig();
    const sent = await api().post(`/api/gigs/${ctx.gig._id}/messages`).set(ctx.client.auth).send({ text: 'Hi Priya!' });
    assert.equal(sent.status, 201);
    const stranger = await registerUser('freelancer');
    assert.equal((await api().get(`/api/gigs/${ctx.gig._id}/messages`).set(stranger.auth)).status, 404);
    const msgs = await api().get(`/api/gigs/${ctx.gig._id}/messages`).set(ctx.freelancer.auth);
    assert.equal(msgs.body.messages[0].sender.name, ctx.client.user.name);

    await new Promise((r) => setTimeout(r, 50)); // notifications are fire-and-forget
    const n = await api().get('/api/notifications').set(ctx.freelancer.auth);
    assert.ok(n.body.unread >= 2); // hired + chat message
    await api().post('/api/notifications/read').set(ctx.freelancer.auth);
    assert.equal((await api().get('/api/notifications').set(ctx.freelancer.auth)).body.unread, 0);
  });
});
