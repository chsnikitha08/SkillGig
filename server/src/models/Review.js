import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    gig: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000, default: '' },
  },
  { timestamps: true },
);

// Each side can review a gig exactly once.
reviewSchema.index({ gig: 1, reviewer: 1 }, { unique: true });

export const Review = mongoose.model('Review', reviewSchema);
