import { z } from 'zod';

const rzpId = (prefix) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]{6,40}$`), 'is not a valid Razorpay id');

export const verifySchema = z.object({
  orderId: rzpId('order'),
  paymentId: rzpId('pay'),
  signature: z.string().regex(/^[a-f0-9]{64}$/, 'is not a valid signature'),
});
