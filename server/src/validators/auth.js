import { z } from 'zod';

const skills = z
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(15)
  .transform((arr) => [...new Set(arr)])
  .default([]);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('must be a valid email'),
  password: z.string().min(8, 'must be at least 8 characters').max(100),
  // Admins are created with `npm run create-admin`, never through public signup.
  role: z.enum(['client', 'freelancer']),
  skills,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('must be a valid email'),
  password: z.string().min(1, 'is required'),
  // Which tab the user picked on the login page. Optional so API clients can omit it.
  role: z.enum(['client', 'freelancer']).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(500).optional(),
  skills: skills.optional(),
});
