import { z } from 'zod';
export const submitSchema = z.object({
  note: z.string().trim().min(5, 'must be at least 5 characters').max(2000),
  link: z
    .string()
    .trim()
    .max(500)
    .url('must be a valid URL')
    .refine((u) => /^https?:\/\//i.test(u), 'must start with http:// or https://')
    .or(z.literal(''))
    .default(''),
});

export const revisionSchema = z.object({
  note: z.string().trim().min(5, 'must be at least 5 characters').max(1000),
});

export const txQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
