import { hmac, safeEqual } from '../src/services/paymentGateway.js';

/**
 * In-memory stand-in for Razorpay. Signs payments with a real HMAC so the
 * server's verification code runs unchanged.
 */
export function createFakeGateway() {
  const SECRET = 'test_key_secret';
  const WEBHOOK_SECRET = 'test_webhook_secret';
  const orders = new Map();
  const payments = new Map();
  let n = 0;
  const id = (p) => `${p}_${String(++n).padStart(10, '0')}`;

  const fake = {
    keyId: 'rzp_test_fake',
    configured: true,
    refunds: [],
    failRefunds: false,
    async createOrder({ amount, receipt, notes }) {
      const order = { id: id('order'), amount, currency: 'INR', receipt, notes };
      orders.set(order.id, order);
      return order;
    },
    async fetchPayment(pid) {
      const p = payments.get(pid);
      if (!p) throw new Error('payment not found');
      return { ...p };
    },
    async fetchOrderPayments(orderId) {
      return [...payments.values()].filter((p) => p.order_id === orderId);
    },
    async capture(pid) {
      const p = payments.get(pid);
      p.status = 'captured';
      return { ...p };
    },
    async refund(paymentId, { amount }) {
      if (fake.failRefunds) throw new Error('Razorpay is down');
      const r = { id: id('rfnd'), payment_id: paymentId, amount };
      fake.refunds.push(r);
      return r;
    },
    verifyPaymentSignature: ({ orderId, paymentId, signature }) => safeEqual(hmac(SECRET, `${orderId}|${paymentId}`), signature),
    verifyWebhookSignature: (raw, sig) => safeEqual(hmac(WEBHOOK_SECRET, raw), sig),

    /** What Razorpay Checkout does in the browser: take the payment, return the signed result. */
    pay(orderId, { amount, status = 'captured' } = {}) {
      const order = orders.get(orderId);
      const payment = { id: id('pay'), order_id: orderId, amount: amount ?? order.amount, currency: 'INR', status };
      payments.set(payment.id, payment);
      return { orderId, paymentId: payment.id, signature: hmac(SECRET, `${orderId}|${payment.id}`) };
    },
    webhook(event, paymentId) {
      const body = JSON.stringify({ event, payload: { payment: { entity: payments.get(paymentId) } } });
      return { body, signature: hmac(WEBHOOK_SECRET, body) };
    },
  };
  return fake;
}
