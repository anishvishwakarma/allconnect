import { Router } from 'express';
import { body } from 'express-validator';
import {
  requestToJoin,
  getPostRequests,
  updateRequest,
  getMyRequests,
} from '../controllers/joinRequestController';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// User's own requests
router.get('/mine', requireAuth, getMyRequests);

// Per-post request operations
router.post(
  '/posts/:postId/request',
  requireAuth,
  body('message').optional().isString().isLength({ max: 300 }),
  validate,
  requestToJoin
);

router.get('/posts/:postId/requests', requireAuth, getPostRequests);

router.put(
  '/posts/:postId/requests/:requestId',
  requireAuth,
  body('action').isIn(['approve', 'reject']).withMessage('action must be approve or reject'),
  validate,
  updateRequest
);

export default router;
