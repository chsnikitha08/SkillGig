import { Gig } from '../models/Gig.js';
import { forbidden, notFound } from '../utils/AppError.js';
import { GIG_STATUS } from './stateMachine.js';

export const isClientOf = (gig, user) => (gig.client._id ?? gig.client).equals(user._id);
export const isFreelancerOf = (gig, user) => Boolean(gig.freelancer) && (gig.freelancer._id ?? gig.freelancer).equals(user._id);
export const isParticipant = (gig, user) => isClientOf(gig, user) || isFreelancerOf(gig, user);

/** Open gigs are visible to everyone; after hiring, only to the two parties and admins. */
export function canView(gig, user) {
  return gig.status === GIG_STATUS.OPEN || isParticipant(gig, user) || user.role === 'admin';
}

export async function findGigOr404(id, { session } = {}) {
  const gig = await Gig.findById(id).session(session ?? null);
  if (!gig) throw notFound('Gig not found');
  return gig;
}

export function assertClientOwner(gig, user) {
  if (!isClientOf(gig, user)) throw forbidden('Only the client who posted this gig can do this', 'NOT_OWNER');
}

export function assertAssignedFreelancer(gig, user) {
  if (!isFreelancerOf(gig, user)) throw forbidden('Only the freelancer assigned to this gig can do this', 'NOT_ASSIGNED');
}
