import { Router } from 'express';
import { cancelGig, createGig, getGig, listGigs, myGigs } from '../controllers/gigController.js';
import { apply, listForGig } from '../controllers/applicationController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
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

export default router;
