import { Gig } from '../models/Gig.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { Dispute } from '../models/Dispute.js';

const sumField = async (Model, match, field) => {
  const [r] = await Model.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: `$${field}` } } }]);
  return r?.total ?? 0;
};

/**
 * Platform overview plus a ledger reconciliation: credits only enter the system via
 * top-ups and never leave, so every top-up must be sitting either in a wallet or in
 * escrow. If the two sides ever differ, money was created or lost by a bug.
 */
export async function stats(req, res) {
  const [usersByRole, gigsByStatus, openDisputes, toppedUp, inWallets, inEscrow] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Gig.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Dispute.countDocuments({ status: 'open' }),
    sumField(Transaction, { type: 'topup' }, 'amount'),
    sumField(User, {}, 'walletBalance'),
    sumField(Gig, {}, 'escrowHeld'),
  ]);
  const toObj = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
  res.json({
    users: toObj(usersByRole),
    gigs: toObj(gigsByStatus),
    openDisputes,
    ledger: { toppedUp, inWallets, inEscrow, balanced: toppedUp === inWallets + inEscrow },
  });
}
