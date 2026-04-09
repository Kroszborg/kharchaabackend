import { Router } from 'express';
import { categoriesController } from '../controllers/categories';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.get('/', categoriesController.list);

export default router;
