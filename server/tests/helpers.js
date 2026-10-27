import { existsSync } from 'node:fs';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';

// Prefer an installed mongod so tests run offline; otherwise mongodb-memory-server downloads one.
for (const bin of ['/opt/homebrew/bin/mongod', '/usr/local/bin/mongod', '/usr/bin/mongod']) {
  if (!process.env.MONGOMS_SYSTEM_BINARY && existsSync(bin)) process.env.MONGOMS_SYSTEM_BINARY = bin;
}

const { createApp } = await import('../src/app.js');
const { setGateway } = await import('../src/services/paymentGateway.js');
const { createFakeGateway } = await import('./fakeGateway.js');

export let gateway;

let replSet;
export let app;

export async function setup() {
  // A replica set (not a standalone server) is required for transactions.
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  app = createApp();
}

export function resetGateway() {
  gateway = createFakeGateway();
  setGateway(gateway);
  return gateway;
}

export async function teardown() {
  const { flushNotifications } = await import('../src/services/notificationService.js');
  await flushNotifications();
  await mongoose.disconnect();
  await replSet?.stop();
}

export async function resetDb() {
  resetGateway();
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

let counter = 0;
export async function registerUser(role, overrides = {}) {
  counter += 1;
  const body = {
    name: `${role} ${counter}`,
    email: `${role}${counter}@test.dev`,
    password: 'password123',
    role,
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user, auth: { Authorization: `Bearer ${res.body.token}` } };
}

export const api = () => request(app);

const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString();

export const gigBody = (over = {}) => ({
  title: 'Logo design for college fest',
  description: 'Need a clean modern logo for our annual tech fest, vector format.',
  skillsRequired: ['design', 'figma'],
  budget: 3000,
  deadline: inDays(7),
  milestones: [
    { title: 'Concepts', amount: 1000 },
    { title: 'Final logo', amount: 2000 },
  ],
  ...over,
});

/** Client posts, freelancer applies at `quote`, client accepts. Returns everything. */
export async function acceptedGig({ quote = 3000, gig: over } = {}) {
  const client = await registerUser('client');
  const freelancer = await registerUser('freelancer');
  const gig = (await api().post('/api/gigs').set(client.auth).send(gigBody(over))).body.gig;
  const app_ = await api()
    .post(`/api/gigs/${gig._id}/apply`)
    .set(freelancer.auth)
    .send({ pitch: 'I can do this well and quickly, see my portfolio.', quotedPrice: quote });
  const acc = await api().post(`/api/applications/${app_.body.application._id}/accept`).set(client.auth);
  return { client, freelancer, gig: acc.body.gig };
}

/** Runs the real funding flow: create order -> (fake) Razorpay checkout -> verify. */
export async function payForGig(ctx, payOpts) {
  const order = await api().post(`/api/gigs/${ctx.gig._id}/fund/order`).set(ctx.client.auth);
  if (order.status !== 201) throw new Error(`order failed: ${JSON.stringify(order.body)}`);
  const checkout = gateway.pay(order.body.orderId, payOpts);
  const res = await api().post(`/api/gigs/${ctx.gig._id}/fund/verify`).set(ctx.client.auth).send(checkout);
  return { order: order.body, checkout, res };
}

export async function fundedGig(opts) {
  const ctx = await acceptedGig(opts);
  const { res } = await payForGig(ctx);
  if (res.status !== 200) throw new Error(`verify failed: ${JSON.stringify(res.body)}`);
  return { ...ctx, gig: res.body.gig };
}

export const balanceOf = async (u) => (await api().get('/api/wallet').set(u.auth)).body;
export const flush = () => new Promise((r) => setTimeout(r, 30));

export async function createAdmin() {
  const bcrypt = (await import('bcryptjs')).default;
  const { User } = await import('../src/models/User.js');
  await User.create({ name: 'Admin', email: 'admin@test.dev', role: 'admin', passwordHash: await bcrypt.hash('password123', 4) });
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.dev', password: 'password123' });
  return { token: res.body.token, user: res.body.user, auth: { Authorization: `Bearer ${res.body.token}` } };
}
