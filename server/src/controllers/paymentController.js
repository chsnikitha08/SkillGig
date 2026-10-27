import * as payments from '../services/paymentService.js';

export async function createOrder(req, res) {
  res.status(201).json(await payments.createFundingOrder(req.valid.params.id, req.user));
}

export async function verify(req, res) {
  res.json(await payments.verifyCheckout(req.valid.params.id, req.user, req.valid.body));
}

export async function sync(req, res) {
  res.json(await payments.syncFunding(req.valid.params.id, req.user));
}

/** Razorpay webhook. Needs the raw body, so it is mounted before express.json(). */
export async function webhook(req, res) {
  const result = await payments.handleWebhook(req.body, req.get('X-Razorpay-Signature'));
  res.json(result);
}
