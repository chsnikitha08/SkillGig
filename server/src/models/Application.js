import mongoose from 'mongoose';

export const APPLICATION_STATUS = ['pending', 'accepted', 'rejected', 'withdrawn'];

const applicationSchema = new mongoose.Schema(
  {
    gig: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pitch: { type: String, required: true, maxlength: 1500 },
    quotedPrice: { type: Number, required: true, min: 1 },
    status: { type: String, enum: APPLICATION_STATUS, default: 'pending' },
  },
  { timestamps: true },
);

// One application per freelancer per gig, enforced by the database even under concurrent requests.
applicationSchema.index({ gig: 1, freelancer: 1 }, { unique: true });

export const Application = mongoose.model('Application', applicationSchema);
