import { Router } from 'express';
import { getOne, list, resolve, respond } from '../controllers/disputeController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { moneyLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { listDisputesSchema, resolveSchema, respondSchema } from '../validators/dispute.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate(listDisputesSchema, 'query'), list);
router.get('/:id', validate(idParam, 'params'), getOne);
router.post('/:id/respond', validate(idParam, 'params'), validate(respondSchema), respond);
router.post('/:id/resolve', requireRole('admin'), moneyLimiter, validate(idParam, 'params'), validate(resolveSchema), resolve);

export default router;
