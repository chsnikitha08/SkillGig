/**
 * Adapter around Razorpay so the rest of the code never imports the SDK directly.
 * Tests swap in a fake with setGateway(); amounts here are in paise.
 */
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function wrap(err) {
  // Razorpay SDK errors look like { statusCode, error: { description } }.
  const description = err?.error?.description || err?.message || 'Unknown error';
  return new AppError(502, `Payment provider error: ${description}`, 'GATEWAY_ERROR');
}

function razorpayGateway() {
  const configured = Boolean(env.razorpay.keyId && env.razorpay.keySecret);
  const client = configured ? new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret }) : null;
  const need = () => {
    if (!client) throw new AppError(503, 'Payments are not configured on this server', 'PAYMENTS_DISABLED');
    return client;
  };
  const call = async (fn) => {
    try {
      return await fn(need());
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw wrap(err);
    }
  };

  return {
    keyId: env.razorpay.keyId,
    configured,
    createOrder: ({ amount, receipt, notes }) => call((c) => c.orders.create({ amount, currency: 'INR', receipt, notes })),
    fetchPayment: (paymentId) => call((c) => c.payments.fetch(paymentId)),
    fetchOrderPayments: (orderId) => call((c) => c.orders.fetchPayments(orderId)).then((r) => r.items ?? []),
    capture: (paymentId, amount) => call((c) => c.payments.capture(paymentId, amount, 'INR')),
    refund: (paymentId, { amount, receipt, notes }) =>
      call((c) => c.payments.refund(paymentId, { amount, receipt, notes, speed: 'normal' })),
    /** Signature Razorpay Checkout returns to the browser: HMAC(order_id|payment_id, key_secret). */
    verifyPaymentSignature: ({ orderId, paymentId, signature }) =>
      configured && safeEqual(hmac(env.razorpay.keySecret, `${orderId}|${paymentId}`), signature),
    /** Webhooks are signed over the raw request body with the webhook secret. */
    verifyWebhookSignature: (rawBody, signature) =>
      Boolean(env.razorpay.webhookSecret) && safeEqual(hmac(env.razorpay.webhookSecret, rawBody), signature),
  };
}

let gateway = null;
export const getGateway = () => {
  gateway ??= razorpayGateway();
  return gateway;
};
export const setGateway = (g) => {
  gateway = g;
};
export { hmac };
