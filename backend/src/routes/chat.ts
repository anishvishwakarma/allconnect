import { Router } from 'express';
import { body } from 'express-validator';
import { getMyChats, getChatMessages, sendMessage } from '../controllers/chatController';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

router.get('/', requireAuth, getMyChats);
router.get('/:chatId/messages', requireAuth, getChatMessages);

router.post(
  '/:chatId/messages',
  requireAuth,
  body('text').trim().notEmpty().isLength({ max: 2000 }).withMessage('text required (max 2000)'),
  validate,
  sendMessage
);

export default router;
