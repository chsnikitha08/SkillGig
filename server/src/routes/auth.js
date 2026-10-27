import { Router } from 'express';
import { login, me, register, updateMe } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema, updateProfileSchema } from '../validators/auth.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, validate(updateProfileSchema), updateMe);

export default router;
