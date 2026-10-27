import { Router } from 'express';
import { getWallet, listTransactions, topUpWallet } from '../controllers/walletController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { moneyLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { topUpSchema, txQuerySchema } from '../validators/escrow.js';

const router = Router();
router.use(requireAuth, requireRole('client', 'freelancer'));

router.get('/', getWallet);
router.post('/topup', moneyLimiter, validate(topUpSchema), topUpWallet);
router.get('/transactions', validate(txQuerySchema, 'query'), listTransactions);

export default router;
