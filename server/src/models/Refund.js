import mongoose from 'mongoose';

/**
 * Outbox for Razorpay refunds. The refund decision is written in the same DB
 * transaction as the escrow change; the call to Razorpay happens after commit and
 * is retried by a background job if it fails, so an outage never loses a refund
 * and never rolls back a dispute decision.
 */
const refundSchema = new mongoose.Schema(
  {
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
    gig: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    milestoneId: { type: mongoose.Schema.Types.ObjectId },
    amount: { type: Number, required: true, min: 1 }, // rupees
    reason: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'processing', 'processed', 'failed'], default: 'pending', index: true },
    razorpayRefundId: String,
    attempts: { type: Number, default: 0 },
    lastError: String,
    processedAt: Date,
    // Same key as the ledger entry, so one decision can never create two refunds.
    key: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export const Refund = mongoose.model('Refund', refundSchema);
