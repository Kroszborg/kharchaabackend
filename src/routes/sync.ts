import { Router } from 'express';
import { syncController } from '../controllers/sync';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.post('/push', syncController.push);
router.get('/pull', syncController.pull);

export default router;
