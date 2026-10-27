import { z } from 'zod';
import { credits } from './common.js';

const MAX_BUDGET = 1_000_000;

const skill = z.string().trim().toLowerCase().min(1).max(30);

export const createGigSchema = z
  .object({
    title: z.string().trim().min(5, 'must be at least 5 characters').max(120),
    description: z.string().trim().min(20, 'must be at least 20 characters').max(5000),
    skillsRequired: z.array(skill).max(10).default([]).transform((a) => [...new Set(a)]),
    budget: credits.max(MAX_BUDGET),
    deadline: z.coerce.date().refine((d) => d.getTime() > Date.now() + 60 * 60 * 1000, 'must be at least 1 hour from now'),
    milestones: z
      .array(z.object({ title: z.string().trim().min(2).max(120), amount: credits }))
      .max(10, 'at most 10 milestones')
      .optional(),
  })
  .superRefine((gig, ctx) => {
    if (gig.milestones?.length) {
      const total = gig.milestones.reduce((s, m) => s + m.amount, 0);
      if (total !== gig.budget) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['milestones'],
          message: `amounts add up to ${total} but the budget is ${gig.budget}`,
        });
      }
    }
  });

const csv = z
  .string()
  .optional()
  .transform((s) => (s ? s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) : []));

export const listGigsSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    skill: csv,
    min: z.coerce.number().min(0).optional(),
    max: z.coerce.number().min(0).optional(),
    dueBefore: z.coerce.date().optional(),
    sort: z.enum(['newest', 'budget_high', 'budget_low', 'deadline']).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .refine((q) => q.min === undefined || q.max === undefined || q.min <= q.max, {
    message: 'min budget cannot be more than max budget',
    path: ['min'],
  });

export const applySchema = z.object({
  pitch: z.string().trim().min(20, 'must be at least 20 characters').max(1500),
  quotedPrice: credits.max(MAX_BUDGET),
});
