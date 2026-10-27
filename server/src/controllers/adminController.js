import { Gig } from '../models/Gig.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { Dispute } from '../models/Dispute.js';
import { Refund } from '../models/Refund.js';
import { notFound } from '../utils/AppError.js';
import { sumField } from '../utils/aggregate.js';
import { processRefund } from '../services/paymentService.js';

/**
 * Platform overview plus a ledger reconciliation. Every rupee paid in through
 * Razorpay must be in exactly one place: still in escrow, released to a freelancer,
 * or refunded to the client. Released money must equal freelancer earnings.
 * If either check fails, money was created or lost by a bug.
 */
export async function stats(req, res) {
  const [usersByRole, gigsByStatus, openDisputes, paidIn, released, refunded, inEscrow, earnings, refundsByStatus, failedRefunds] =
    await Promise.all([
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Gig.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Dispute.countDocuments({ status: 'open' }),
      sumField(Transaction, { type: 'fund' }, 'amount'),
      sumField(Transaction, { type: 'release' }, 'amount'),
      sumField(Transaction, { type: 'refund' }, 'amount'),
      sumField(Gig, {}, 'escrowHeld'),
      sumField(User, { role: 'freelancer' }, 'walletBalance'),
      Refund.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Refund.find({ status: 'failed' }).sort({ updatedAt: -1 }).limit(20).populate('gig', 'title'),
    ]);
  const toObj = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
  res.json({
    users: toObj(usersByRole),
    gigs: toObj(gigsByStatus),
    openDisputes,
    ledger: {
      paidIn,
      inEscrow,
      released,
      refunded,
      earnings,
      balanced: paidIn === inEscrow + released + refunded && released === earnings,
    },
    refunds: toObj(refundsByStatus),
    failedRefunds,
  });
}

export async function retryRefund(req, res) {
  if (!(await Refund.exists({ _id: req.valid.params.id }))) throw notFound('Refund not found');
  res.json({ refund: await processRefund(req.valid.params.id) });
}
