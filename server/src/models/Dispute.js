import mongoose from 'mongoose';

export const DISPUTE_DECISIONS = ['release', 'refund', 'split'];

const disputeSchema = new mongoose.Schema(
  {
    gig: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true, index: true },
    milestoneId: { type: mongoose.Schema.Types.ObjectId, required: true },
    milestoneTitle: { type: String, required: true },
    amount: { type: Number, required: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    against: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, maxlength: 2000 },
    response: { type: String, maxlength: 2000, default: '' },
    respondedAt: Date,
    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
    decision: { type: String, enum: DISPUTE_DECISIONS },
    freelancerAmount: Number,
    clientAmount: Number,
    adminNote: { type: String, maxlength: 2000, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true },
);

// At most one open dispute per milestone.
disputeSchema.index({ milestoneId: 1 }, { unique: true, partialFilterExpression: { status: 'open' } });

export const Dispute = mongoose.model('Dispute', disputeSchema);
