import * as escrow from '../services/escrowService.js';

export async function fund(req, res) {
  res.json(await escrow.fundGig(req.valid.params.id, req.user));
}

export async function submit(req, res) {
  const { id, mid } = req.valid.params;
  res.json(await escrow.submitMilestone(id, mid, req.user, req.valid.body));
}

export async function revise(req, res) {
  const { id, mid } = req.valid.params;
  res.json(await escrow.requestRevision(id, mid, req.user, req.valid.body));
}

export async function approve(req, res) {
  const { id, mid } = req.valid.params;
  res.json(await escrow.approveMilestone(id, mid, req.user));
}
