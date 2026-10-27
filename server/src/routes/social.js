import { Router } from 'express';
import { listMessages, listNotifications, markAllRead, profile, review, sendMessage } from '../controllers/socialController.js';
import { raise } from '../controllers/disputeController.js';
import { retryRefund, stats } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { gigMilestoneParams, idParam } from '../validators/common.js';
import { messageSchema, raiseDisputeSchema, reviewSchema } from '../validators/dispute.js';

/** Smaller endpoints grouped by URL rather than given a file each. */
const router = Router();
router.use(requireAuth);
const id = validate(idParam, 'params');

router.post('/gigs/:id/milestones/:mid/dispute', validate(gigMilestoneParams, 'params'), validate(raiseDisputeSchema), raise);
router.post('/gigs/:id/review', requireRole('client', 'freelancer'), id, validate(reviewSchema), review);
router.get('/gigs/:id/messages', id, listMessages);
router.post('/gigs/:id/messages', id, validate(messageSchema), sendMessage);

router.get('/users/:id', id, profile);

router.get('/notifications', listNotifications);
router.post('/notifications/read', markAllRead);

router.get('/admin/stats', requireRole('admin'), stats);
router.post('/admin/refunds/:id/retry', requireRole('admin'), id, retryRefund);

export default router;
