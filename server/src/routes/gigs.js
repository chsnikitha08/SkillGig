import { Router } from 'express';
import { cancelGig, createGig, getGig, listGigs, myGigs } from '../controllers/gigController.js';
import { apply, listForGig } from '../controllers/applicationController.js';
import { approve, fund, revise, submit } from '../controllers/escrowController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { moneyLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { gigMilestoneParams, idParam } from '../validators/common.js';
import { revisionSchema, submitSchema } from '../validators/escrow.js';
import { applySchema, createGigSchema, listGigsSchema } from '../validators/gig.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate(listGigsSchema, 'query'), listGigs);
router.post('/', requireRole('client'), validate(createGigSchema), createGig);
router.get('/mine', myGigs);
router.get('/:id', validate(idParam, 'params'), getGig);
router.post('/:id/cancel', requireRole('client'), validate(idParam, 'params'), cancelGig);
router.post('/:id/apply', requireRole('freelancer'), validate(idParam, 'params'), validate(applySchema), apply);
router.get('/:id/applications', requireRole('client', 'admin'), validate(idParam, 'params'), listForGig);

// Escrow workflow
const ms = validate(gigMilestoneParams, 'params');
router.post('/:id/fund', requireRole('client'), moneyLimiter, validate(idParam, 'params'), fund);
router.post('/:id/milestones/:mid/submit', requireRole('freelancer'), ms, validate(submitSchema), submit);
router.post('/:id/milestones/:mid/revision', requireRole('client'), ms, validate(revisionSchema), revise);
router.post('/:id/milestones/:mid/approve', requireRole('client'), moneyLimiter, ms, approve);

export default router;
