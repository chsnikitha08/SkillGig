/**
 * Creates the platform admin (or resets its password). Admins can't sign up through
 * the app; this script is the only way to create one.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password' npm run create-admin
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';

const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'SkillGig Admin' } = process.env;

async function main() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not set');
  if (!ADMIN_EMAIL || !/^\S+@\S+\.\S+$/.test(ADMIN_EMAIL)) throw new Error('Set ADMIN_EMAIL to a valid email');
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) throw new Error('Set ADMIN_PASSWORD (at least 12 characters)');

  await mongoose.connect(MONGODB_URI);
  await User.syncIndexes();
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const existing = await User.findOne({ email });
  if (existing && existing.role !== 'admin') {
    throw new Error(`${email} already belongs to a ${existing.role} account; use a different email for the admin`);
  }
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.name = ADMIN_NAME;
    await existing.save();
    console.log(`Admin ${email} already existed; password updated.`);
  } else {
    await User.create({ name: ADMIN_NAME, email, role: 'admin', passwordHash });
    console.log(`Admin ${email} created.`);
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
