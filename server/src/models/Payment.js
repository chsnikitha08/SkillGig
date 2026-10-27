import mongoose from 'mongoose';

/**
 * A client's payment that funds a gig's escrow. One Razorpay order per attempt;
 * becomes `paid` only after the server has verified the payment with Razorpay.
 *
 * provider 'demo' is used only by the seed script for pre-funded demo gigs, so the
 * demo works without real checkouts. Refunds on demo payments are simulated.
 */
const paymentSchema = new mongoose.Schema(
  {
    gig: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['razorpay', 'demo'], default: 'razorpay' },
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String },
    amount: { type: Number, required: true, min: 1 }, // rupees
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['created', 'paid'], default: 'created' },
    // True when the payment arrived for a gig that could no longer be funded
    // (cancelled meanwhile, or paid twice from two tabs); it is refunded in full.
    surplus: { type: Boolean, default: false },
    refundedAmount: { type: Number, default: 0 },
    paidAt: Date,
  },
  { timestamps: true },
);

paymentSchema.index({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: 'string' } } });

export const Payment = mongoose.model('Payment', paymentSchema);
