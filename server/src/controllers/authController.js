import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { signToken } from '../utils/jwt.js';
import { conflict, unauthorized } from '../utils/AppError.js';

const SALT_ROUNDS = 10;

export async function register(req, res) {
  const { name, email, password, role, skills } = req.valid.body;
  if (await User.exists({ email })) throw conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash, role, skills: role === 'freelancer' ? skills : [] });
  res.status(201).json({ token: signToken(user), user });
}

export async function login(req, res) {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password so accounts can't be enumerated.
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw unauthorized('Incorrect email or password', 'BAD_CREDENTIALS');
  res.json({ token: signToken(user), user });
}

export async function me(req, res) {
  res.json({ user: req.user });
}

export async function updateMe(req, res) {
  const updates = { ...req.valid.body };
  if (req.user.role !== 'freelancer') delete updates.skills;
  Object.assign(req.user, updates);
  await req.user.save();
  res.json({ user: req.user });
}
