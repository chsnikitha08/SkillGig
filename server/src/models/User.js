import mongoose from 'mongoose';

export const ROLES = ['client', 'freelancer', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    bio: { type: String, maxlength: 500, default: '' },
    skills: { type: [String], default: [] },
    // Available (spendable) credits. Money locked in escrow is tracked on the gig, not here.
    walletBalance: { type: Number, default: 0, min: 0 },
    // Ratings are stored as a running sum so the average can be updated atomically with $inc.
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedGigs: { type: Number, default: 0 },
  },
  { timestamps: true },
);

userSchema.virtual('ratingAvg').get(function ratingAvg() {
  return this.ratingCount ? Math.round((this.ratingSum / this.ratingCount) * 10) / 10 : null;
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
