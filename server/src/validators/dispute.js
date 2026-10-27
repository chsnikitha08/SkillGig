import { z } from 'zod';

const text = (min, max) => z.string().trim().min(min, `must be at least ${min} characters`).max(max);

export const raiseDisputeSchema = z.object({ reason: text(20, 2000) });
export const respondSchema = z.object({ response: text(10, 2000) });

export const resolveSchema = z
  .object({
    decision: z.enum(['release', 'refund', 'split']),
    freelancerAmount: z.coerce.number().int().optional(),
    note: text(10, 2000),
  })
  .refine((v) => v.decision !== 'split' || v.freelancerAmount !== undefined, {
    message: 'is required for a split',
    path: ['freelancerAmount'],
  });

export const listDisputesSchema = z.object({ status: z.enum(['open', 'resolved', 'all']).default('open') });

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(''),
});

export const messageSchema = z.object({ text: text(1, 2000) });
