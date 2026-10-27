/**
 * Thin wrapper around the Socket.io server so services can push events without
 * depending on it. Before attach() (e.g. in tests) every emit is a no-op.
 */
let io = null;

export const attachRealtime = (server) => {
  io = server;
};

export const emitToUser = (userId, event, payload) => io?.to(`user:${userId}`).emit(event, payload);
export const emitToGig = (gigId, event, payload) => io?.to(`gig:${gigId}`).emit(event, payload);

/** Tells everyone viewing a gig page that it changed, so they refetch. */
export const gigChanged = (gigId) => emitToGig(gigId.toString(), 'gig:updated', { gigId: gigId.toString() });
