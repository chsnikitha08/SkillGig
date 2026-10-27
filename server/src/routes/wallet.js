import { Router } from 'express';
import { getWallet, listTransactions } from '../controllers/walletController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { txQuerySchema } from '../validators/escrow.js';

const router = Router();
router.use(requireAuth, requireRole('client', 'freelancer'));

router.get('/', getWallet);
router.get('/transactions', validate(txQuerySchema, 'query'), listTransactions);

export default router;
