import { Router } from 'express';
import { accept, withdraw } from '../controllers/applicationController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';

const router = Router();
router.use(requireAuth);

router.post('/:id/accept', requireRole('client'), validate(idParam, 'params'), accept);
router.post('/:id/withdraw', requireRole('freelancer'), validate(idParam, 'params'), withdraw);

export default router;
