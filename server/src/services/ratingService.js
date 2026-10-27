import mongoose from 'mongoose';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { conflict, forbidden } from '../utils/AppError.js';
import { findGigOr404, isClientOf, isParticipant } from './gigAccess.js';
import { GIG_STATUS } from './stateMachine.js';
import { notify } from './notificationService.js';

/** Both sides review each other once after completion; the reviewee's average updates atomically. */
export async function leaveReview(gigId, user, { rating, comment }) {
  let review;
  let gig;
  await mongoose.connection.transaction(async (session) => {
    gig = await findGigOr404(gigId, { session });
    if (!isParticipant(gig, user)) throw forbidden('Only the client and freelancer of this gig can review it');
    if (gig.status !== GIG_STATUS.COMPLETED) throw conflict('You can leave a review once the gig is completed', 'NOT_COMPLETED');

    const reviewee = isClientOf(gig, user) ? gig.freelancer : gig.client;
    try {
      [review] = await Review.create([{ gig: gig._id, reviewer: user._id, reviewee, rating, comment }], { session });
    } catch (err) {
      if (err.code === 11000) throw conflict('You have already reviewed this gig', 'ALREADY_REVIEWED');
      throw err;
    }
    await User.updateOne({ _id: reviewee }, { $inc: { ratingSum: rating, ratingCount: 1 } }, { session });
  });
  notify(review.reviewee, 'review_received', `${user.name} rated you ${rating}/5 for "${gig.title}"`, gig._id);
  return { review };
}
