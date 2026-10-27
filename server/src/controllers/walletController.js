import { Gig } from '../models/Gig.js';
import { Payment } from '../models/Payment.js';
import { Refund } from '../models/Refund.js';
import { Transaction } from '../models/Transaction.js';
import { GIG_STATUS } from '../services/stateMachine.js';
import { sumField } from '../utils/aggregate.js';

/**
 * Freelancers: earnings released to them, plus what is in escrow for their active gigs.
 * Clients: what they paid through Razorpay, what is locked in escrow, what was refunded.
 */
export async function getWallet(req, res) {
  const { _id, role, walletBalance } = req.user;
  if (role === 'freelancer') {
    const inEscrow = await sumField(Gig, { status: GIG_STATUS.IN_PROGRESS, freelancer: _id }, 'escrowHeld');
    return res.json({ earnings: walletBalance, inEscrow });
  }
  const [paid, inEscrow, refunded, pendingRefunds] = await Promise.all([
    sumField(Payment, { client: _id, status: 'paid' }, 'amount'),
    sumField(Gig, { status: GIG_STATUS.IN_PROGRESS, client: _id }, 'escrowHeld'),
    sumField(Refund, { client: _id, status: 'processed' }, 'amount'),
    sumField(Refund, { client: _id, status: { $ne: 'processed' } }, 'amount'),
  ]);
  res.json({ paid, inEscrow, refunded, pendingRefunds });
}

export async function listTransactions(req, res) {
  const { page, limit } = req.valid.query;
  const filter = { $or: [{ fromUser: req.user._id }, { toUser: req.user._id }] };
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('gig', 'title').lean(),
    Transaction.countDocuments(filter),
  ]);
  // Attach the Razorpay refund status to refund entries so clients can track them.
  const refunds = await Refund.find({ key: { $in: items.filter((t) => t.type === 'refund').map((t) => t.key) } }).lean();
  const byKey = new Map(refunds.map((r) => [r.key, r]));
  for (const t of items) {
    const r = byKey.get(t.key);
    if (r) t.refund = { status: r.status, razorpayRefundId: r.razorpayRefundId, lastError: r.status === 'failed' ? 'Retrying automatically' : undefined };
  }
  res.json({ items, page, total, pages: Math.max(1, Math.ceil(total / limit)) });
}
