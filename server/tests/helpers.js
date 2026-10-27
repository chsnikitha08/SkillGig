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

let replSet;
export let app;

export async function setup() {
  // A replica set (not a standalone server) is required for transactions.
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  app = createApp();
}

export async function teardown() {
  await mongoose.disconnect();
  await replSet?.stop();
}

export async function resetDb() {
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
