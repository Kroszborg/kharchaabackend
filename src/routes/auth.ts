import { Router } from 'express';
import { authController } from '../controllers/auth';
import { authLimiter } from '../middleware/rate-limiter';

const router = Router();

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

export default router;
