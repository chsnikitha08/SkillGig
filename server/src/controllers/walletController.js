import { Gig } from '../models/Gig.js';
import { Transaction } from '../models/Transaction.js';
import { GIG_STATUS } from '../services/stateMachine.js';
import { topUp } from '../services/escrowService.js';

export async function getWallet(req, res) {
  const { _id, role, walletBalance } = req.user;
  // "In escrow" = money locked in active gigs: what a client has committed,
  // or what a freelancer will receive once milestones are approved.
  const match = { status: GIG_STATUS.IN_PROGRESS, [role === 'freelancer' ? 'freelancer' : 'client']: _id };
  const [agg] = await Gig.aggregate([{ $match: match }, { $group: { _id: null, held: { $sum: '$escrowHeld' } } }]);
  res.json({ walletBalance, inEscrow: agg?.held ?? 0 });
}

export async function topUpWallet(req, res) {
  const result = await topUp(req.user, req.valid.body.amount, req.get('Idempotency-Key'));
  res.status(result.duplicate ? 200 : 201).json(result);
}

export async function listTransactions(req, res) {
  const { page, limit } = req.valid.query;
  const filter = { $or: [{ fromUser: req.user._id }, { toUser: req.user._id }] };
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('gig', 'title'),
    Transaction.countDocuments(filter),
  ]);
  res.json({ items, page, total, pages: Math.max(1, Math.ceil(total / limit)) });
}
