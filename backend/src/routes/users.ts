import { Router } from 'express';
import { getMe, updateMe } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/me', requireAuth, getMe);
router.put('/me', requireAuth, updateMe);
router.patch('/me', requireAuth, updateMe); // PATCH alias for compatibility

export default router;
