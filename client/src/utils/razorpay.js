import { http } from '../api/http';

const SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
let loading;

/** Loads Razorpay Checkout once, on first use. */
export function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load Razorpay Checkout. Check your connection or disable ad blockers.'));
    };
    document.body.appendChild(s);
  });
  return loading;
}

/**
 * Opens Razorpay Checkout for a gig and verifies the result on the server.
 * Resolves with { cancelled: true } if the user closes the checkout. If the verify
 * call fails on the network, falls back to a server-side sync so a completed
 * payment is never lost.
 */
export async function payForGig(gigId) {
  const [Razorpay, { data: order }] = await Promise.all([loadCheckout(), http.post(`/gigs/${gigId}/fund/order`)]);

  const result = await new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'SkillGig',
      description: `Secure payment for "${order.gig.title}"`,
      prefill: order.prefill,
      theme: { color: '#5bbb7b' },
      handler: (resp) =>
        resolve({ orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature }),
      modal: { ondismiss: () => resolve({ cancelled: true }) },
    });
    rzp.on('payment.failed', (resp) => reject(new Error(resp.error?.description || 'Payment failed')));
    rzp.open();
  });
  if (result.cancelled) return result;

  try {
    const { data } = await http.post(`/gigs/${gigId}/fund/verify`, result);
    return data;
  } catch (err) {
    if (err.response) throw err; // the server rejected it: show that message
    const { data } = await http.post(`/gigs/${gigId}/fund/sync`);
    return data;
  }
}
