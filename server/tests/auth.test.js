import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerUser, resetDb, setup, teardown } from './helpers.js';

before(setup);
after(teardown);
beforeEach(resetDb);

describe('auth', () => {
  it('registers, logs in and never returns the password hash', async () => {
    const { user } = await registerUser('client', { email: 'a@test.dev' });
    assert.equal(user.passwordHash, undefined);
    assert.equal(user.walletBalance, 0);

    const res = await api().post('/api/auth/login').send({ email: 'A@test.dev', password: 'password123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  it('rejects duplicate emails and wrong passwords', async () => {
    await registerUser('client', { email: 'dup@test.dev' });
    const dup = await api()
      .post('/api/auth/register')
      .send({ name: 'X Y', email: 'dup@test.dev', password: 'password123', role: 'client' });
    assert.equal(dup.status, 409);

    const bad = await api().post('/api/auth/login').send({ email: 'dup@test.dev', password: 'nope-nope' });
    assert.equal(bad.status, 401);
  });

  it('does not allow signing up as admin', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Evil', email: 'evil@test.dev', password: 'password123', role: 'admin' });
    assert.equal(res.status, 400);
  });

  it('strips operator injection from login', async () => {
    const res = await api().post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 400);
  });

  it('requires a valid token for /me', async () => {
    assert.equal((await api().get('/api/auth/me')).status, 401);
    assert.equal((await api().get('/api/auth/me').set('Authorization', 'Bearer junk')).status, 401);
    const { auth } = await registerUser('freelancer', { skills: ['Figma', 'figma', 'React'] });
    const res = await api().get('/api/auth/me').set(auth);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.user.skills, ['figma', 'react']);
  });
});
