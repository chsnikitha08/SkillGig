import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { api, gigBody, registerUser, resetDb, setup, teardown } from './helpers.js';

const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString();

before(setup);
after(teardown);
beforeEach(resetDb);

describe('gigs and applications', () => {
  it('only clients can post, and milestones must add up to the budget', async () => {
    const f = await registerUser('freelancer');
    const c = await registerUser('client');
    assert.equal((await api().post('/api/gigs').set(f.auth).send(gigBody())).status, 403);
    const bad = await api().post('/api/gigs').set(c.auth).send(gigBody({ budget: 2500 }));
    assert.equal(bad.status, 400);
    assert.match(bad.body.error.message, /add up to 3000/);
    const past = await api().post('/api/gigs').set(c.auth).send(gigBody({ deadline: inDays(-1) }));
    assert.equal(past.status, 400);
    const ok = await api().post('/api/gigs').set(c.auth).send(gigBody({ milestones: undefined }));
    assert.equal(ok.status, 201);
    assert.equal(ok.body.gig.milestones.length, 1);
    assert.equal(ok.body.gig.milestones[0].amount, 3000);
  });

  it('searches and filters open gigs', async () => {
    const c = await registerUser('client');
    await api().post('/api/gigs').set(c.auth).send(gigBody());
    await api().post('/api/gigs').set(c.auth).send(gigBody({ title: 'Type my physics notes', skillsRequired: ['typing'], budget: 200, milestones: undefined }));
    const all = await api().get('/api/gigs').set(c.auth);
    assert.equal(all.body.total, 2);
    // Visitors can browse without logging in, but can't open private actions.
    assert.equal((await api().get('/api/gigs')).body.total, 2);
    assert.equal((await api().get('/api/gigs/mine')).status, 401);
    const byQ = await api().get('/api/gigs?q=physics').set(c.auth);
    assert.equal(byQ.body.total, 1);
    const bySkill = await api().get('/api/gigs?skill=design').set(c.auth);
    assert.equal(bySkill.body.items[0].title, 'Logo design for college fest');
    const byBudget = await api().get('/api/gigs?min=100&max=500').set(c.auth);
    assert.equal(byBudget.body.total, 1);
    const regexy = await api().get('/api/gigs?q=.*(').set(c.auth);
    assert.equal(regexy.status, 200);
    assert.equal((await api().get('/api/gigs?min=10&max=1').set(c.auth)).status, 400);
  });

  it('apply -> accept rescales milestones to the quote and rejects the others', async () => {
    const c = await registerUser('client');
    const f1 = await registerUser('freelancer');
    const f2 = await registerUser('freelancer');
    const gig = (await api().post('/api/gigs').set(c.auth).send(gigBody())).body.gig;

    const pitch = { pitch: 'I have designed logos for three college clubs already.', quotedPrice: 2700 };
    const a1 = await api().post(`/api/gigs/${gig._id}/apply`).set(f1.auth).send(pitch);
    assert.equal(a1.status, 201);
    assert.equal((await api().post(`/api/gigs/${gig._id}/apply`).set(f1.auth).send(pitch)).status, 409);
    const a2 = await api().post(`/api/gigs/${gig._id}/apply`).set(f2.auth).send({ ...pitch, quotedPrice: 3000 });

    // Freelancers can't see the applicant list; another client can't accept.
    assert.equal((await api().get(`/api/gigs/${gig._id}/applications`).set(f1.auth)).status, 403);
    const other = await registerUser('client');
    assert.equal((await api().post(`/api/applications/${a1.body.application._id}/accept`).set(other.auth)).status, 403);

    const acc = await api().post(`/api/applications/${a1.body.application._id}/accept`).set(c.auth);
    assert.equal(acc.status, 200);
    assert.equal(acc.body.gig.status, 'accepted');
    assert.equal(acc.body.gig.agreedAmount, 2700);
    assert.deepEqual(acc.body.gig.milestones.map((m) => m.amount), [900, 1800]);

    const again = await api().post(`/api/applications/${a2.body.application._id}/accept`).set(c.auth);
    assert.equal(again.status, 409);

    const list = await api().get(`/api/gigs/${gig._id}/applications`).set(c.auth);
    assert.deepEqual(list.body.applications.map((a) => a.status).sort(), ['accepted', 'rejected']);

    // No longer open: a stranger can't see it, the hired freelancer can.
    assert.equal((await api().get(`/api/gigs/${gig._id}`).set(f2.auth)).status, 404);
    assert.equal((await api().get(`/api/gigs/${gig._id}`).set(f1.auth)).status, 200);
  });

  it('can cancel before funding only by the owner', async () => {
    const c = await registerUser('client');
    const gig = (await api().post('/api/gigs').set(c.auth).send(gigBody())).body.gig;
    const other = await registerUser('client');
    assert.equal((await api().post(`/api/gigs/${gig._id}/cancel`).set(other.auth)).status, 403);
    const res = await api().post(`/api/gigs/${gig._id}/cancel`).set(c.auth);
    assert.equal(res.body.gig.status, 'cancelled');
    assert.equal((await api().post(`/api/gigs/${gig._id}/cancel`).set(c.auth)).status, 409);
  });
});
