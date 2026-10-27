/**
 * The single source of truth for which status changes are legal.
 * Services call assert*Transition before every write, and the write itself is
 * conditional on the expected current status, so a concurrent request that
 * changed the state in between makes the write match nothing (see escrowService).
 */
import { conflict } from '../utils/AppError.js';

export const GIG_STATUS = {
  OPEN: 'open', // accepting applications
  ACCEPTED: 'accepted', // freelancer chosen, waiting for client to fund escrow
  IN_PROGRESS: 'in_progress', // escrow funded, work happening
  COMPLETED: 'completed', // every milestone settled (released, refunded or split)
  CANCELLED: 'cancelled', // only possible before funding
};

export const MILESTONE_STATUS = {
  PENDING: 'pending', // gig not funded yet
  FUNDED: 'funded', // money locked in escrow, freelancer working
  SUBMITTED: 'submitted', // freelancer delivered, waiting for client
  DISPUTED: 'disputed', // admin must decide
  RELEASED: 'released', // escrow paid to freelancer
  REFUNDED: 'refunded', // escrow returned to client (admin decision)
  SPLIT: 'split', // escrow divided between both (admin decision)
};

const G = GIG_STATUS;
const M = MILESTONE_STATUS;

export const GIG_TRANSITIONS = {
  [G.OPEN]: [G.ACCEPTED, G.CANCELLED],
  [G.ACCEPTED]: [G.IN_PROGRESS, G.CANCELLED],
  [G.IN_PROGRESS]: [G.COMPLETED],
  [G.COMPLETED]: [],
  [G.CANCELLED]: [],
};

export const MILESTONE_TRANSITIONS = {
  [M.PENDING]: [M.FUNDED],
  [M.FUNDED]: [M.SUBMITTED, M.DISPUTED], // dispute here = freelancer missed the deadline
  [M.SUBMITTED]: [M.RELEASED, M.FUNDED, M.DISPUTED], // FUNDED = client asked for a revision
  [M.DISPUTED]: [M.RELEASED, M.REFUNDED, M.SPLIT],
  [M.RELEASED]: [],
  [M.REFUNDED]: [],
  [M.SPLIT]: [],
};

export const TERMINAL_MILESTONE = new Set([M.RELEASED, M.REFUNDED, M.SPLIT]);

const label = (s) => s.replace('_', ' ');

export const canGigTransition = (from, to) => GIG_TRANSITIONS[from]?.includes(to) ?? false;
export const canMilestoneTransition = (from, to) => MILESTONE_TRANSITIONS[from]?.includes(to) ?? false;

export function assertGigTransition(from, to, action) {
  if (!canGigTransition(from, to)) {
    throw conflict(`Cannot ${action}: this gig is ${label(from)}`, 'INVALID_STATE');
  }
}

export function assertMilestoneTransition(from, to, action) {
  if (!canMilestoneTransition(from, to)) {
    throw conflict(`Cannot ${action}: this milestone is ${label(from)}`, 'INVALID_STATE');
  }
}

export const allMilestonesSettled = (milestones) => milestones.every((m) => TERMINAL_MILESTONE.has(m.status));
