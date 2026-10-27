import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    gig: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ gig: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
