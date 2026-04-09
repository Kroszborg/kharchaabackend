import { Router } from 'express';
import { emailParseController } from '../controllers/email-parse';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.post('/parse', emailParseController.parse);
router.post('/parse/bulk', emailParseController.parseBulk);

export default router;
