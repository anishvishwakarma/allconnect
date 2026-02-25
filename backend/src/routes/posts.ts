import { Router } from 'express';
import { body, query } from 'express-validator';
import {
  getNearbyPosts,
  getMyPosts,
  getPostHistory,
  getPost,
  createPost,
  deletePost,
} from '../controllers/postController';
import { requireAuth } from '../middleware/auth';
import { postLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validation';
import { POST_CATEGORIES } from '../models/Post';

const router = Router();

router.get(
  '/nearby',
  query('lat').notEmpty().isFloat().withMessage('lat must be a number'),
  query('lng').notEmpty().isFloat().withMessage('lng must be a number'),
  query('radius').optional().isFloat({ min: 0.1, max: 50 }),
  validate,
  getNearbyPosts
);

router.get('/mine', requireAuth, getMyPosts);
router.get('/history', requireAuth, getPostHistory);
router.get('/:id', getPost);

router.post(
  '/',
  requireAuth,
  postLimiter,
  body('title').trim().notEmpty().isLength({ max: 100 }).withMessage('title required (max 100 chars)'),
  body('category').isIn(POST_CATEGORIES).withMessage('Invalid category'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('eventAt').isISO8601().withMessage('eventAt must be a valid date'),
  body('durationMinutes').isInt({ min: 15, max: 1440 }).withMessage('durationMinutes 15–1440'),
  body('maxParticipants').isInt({ min: 2, max: 100 }).withMessage('maxParticipants 2–100'),
  body('costPerPerson').optional().isFloat({ min: 0 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  validate,
  createPost
);

router.delete('/:id', requireAuth, deletePost);

export default router;
