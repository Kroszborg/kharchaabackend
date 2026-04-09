import { Router } from 'express';
import { transactionsController } from '../controllers/transactions';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', transactionsController.list);
router.post('/', transactionsController.create);
router.post('/bulk', transactionsController.bulk);
router.get('/:id', transactionsController.getOne);
router.put('/:id', transactionsController.update);
router.delete('/:id', transactionsController.remove);

export default router;
