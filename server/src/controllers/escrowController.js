import * as escrow from '../services/escrowService.js';
import { gigChanged } from '../services/realtime.js';

// Each handler runs the service, then tells anyone viewing the gig page to refresh.
const handle = (fn) => async (req, res) => {
  const result = await fn(req);
  gigChanged(req.valid.params.id);
  res.json(result);
};

export const submit = handle((req) => escrow.submitMilestone(req.valid.params.id, req.valid.params.mid, req.user, req.valid.body));
export const revise = handle((req) => escrow.requestRevision(req.valid.params.id, req.valid.params.mid, req.user, req.valid.body));
export const approve = handle((req) => escrow.approveMilestone(req.valid.params.id, req.valid.params.mid, req.user));
