import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a valid id');
export const credits = z.coerce.number().int('must be a whole number').positive('must be greater than 0');
export const idParam = z.object({ id: objectId });
export const gigMilestoneParams = z.object({ id: objectId, mid: objectId });
