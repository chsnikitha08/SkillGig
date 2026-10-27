import mongoose from 'mongoose';
import { GIG_STATUS, MILESTONE_STATUS } from '../services/stateMachine.js';

const milestoneSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: Object.values(MILESTONE_STATUS), default: MILESTONE_STATUS.PENDING },
    submissionNote: { type: String, default: '' },
    submissionLink: { type: String, default: '' },
    submittedAt: Date,
    revisionNote: { type: String, default: '' },
    revisionCount: { type: Number, default: 0 },
    // How the escrowed amount was finally settled (releasedAmount + refundedAmount === amount).
    releasedAmount: { type: Number, default: 0 },
    refundedAmount: { type: Number, default: 0 },
    settledAt: Date,
  },
  { _id: true },
);

const gigSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 5000 },
    skillsRequired: { type: [String], default: [], index: true },
    budget: { type: Number, required: true, min: 1 },
    // Price agreed when an application is accepted (the freelancer's quote). Milestones sum to this.
    agreedAmount: { type: Number },
    deadline: { type: Date, required: true },
    status: { type: String, enum: Object.values(GIG_STATUS), default: GIG_STATUS.OPEN, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    milestones: { type: [milestoneSchema], validate: (v) => v.length >= 1 && v.length <= 10 },
    // The verified Razorpay payment that funded escrow (refunds are issued against it).
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    // Rupees currently locked in escrow for this gig.
    escrowHeld: { type: Number, default: 0, min: 0 },
    applicationCount: { type: Number, default: 0 },
    acceptedAt: Date,
    fundedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true },
);

gigSchema.index({ status: 1, createdAt: -1 });

gigSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Gig = mongoose.model('Gig', gigSchema);
