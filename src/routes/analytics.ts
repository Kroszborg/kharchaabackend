import { Router } from 'express';
import { analyticsController } from '../controllers/analytics';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/summary', analyticsController.summary);
router.get('/categories', analyticsController.categories);
router.get('/merchants', analyticsController.merchants);
router.get('/insights', analyticsController.insights);

export default router;
