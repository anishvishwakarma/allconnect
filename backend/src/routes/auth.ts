import { Router } from 'express';
import { body } from 'express-validator';
import { verifyAuth } from '../controllers/authController';
import { authLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validation';

const router = Router();

router.post(
  '/verify',
  authLimiter,
  body('idToken').notEmpty().withMessage('idToken is required'),
  validate,
  verifyAuth
);

export default router;
