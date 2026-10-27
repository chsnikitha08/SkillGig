import mongoose from 'mongoose';

export const TX_TYPES = ['topup', 'fund', 'release', 'refund'];

/**
 * Append-only money ledger. Every balance change writes exactly one entry, in the
 * same MongoDB transaction as the balance change itself.
 *
 *   topup:   outside world -> user wallet        (fromUser = null)
 *   fund:    client wallet -> gig escrow         (toUser = null)
 *   release: gig escrow    -> freelancer wallet  (fromUser = null)
 *   refund:  gig escrow    -> client wallet      (fromUser = null)
 */
const transactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TX_TYPES, required: true },
    amount: { type: Number, required: true, min: 1 },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    gig: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig' },
    milestoneId: { type: mongoose.Schema.Types.ObjectId },
    note: { type: String, default: '' },
    // Deterministic key per money operation (e.g. "release:<milestoneId>"). The unique
    // index makes it impossible to record the same operation twice, even under races.
    key: { type: String, required: true, unique: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

transactionSchema.index({ fromUser: 1, createdAt: -1 });
transactionSchema.index({ toUser: 1, createdAt: -1 });

function immutable() {
  throw new Error('Ledger entries are immutable');
}
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndReplace']) {
  transactionSchema.pre(op, immutable);
}
transactionSchema.pre('save', function onlyInsert(next) {
  if (!this.isNew) return next(new Error('Ledger entries are immutable'));
  next();
});

export const Transaction = mongoose.model('Transaction', transactionSchema);
