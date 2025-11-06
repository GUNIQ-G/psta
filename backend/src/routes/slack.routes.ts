import express, { RequestHandler } from 'express';
import {
  getAllSlackConfigs,
  getSlackConfigById,
  createSlackConfig,
  updateSlackConfig,
  deleteSlackConfig,
  testSlackConnection,
  getSlackUserByEmail,
  sendDirectMessage,
  sendDirectMessageByEmail,
} from '../controllers/slack.controller';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.get('/', authMiddleware as RequestHandler, getAllSlackConfigs as RequestHandler);
router.get('/:id', authMiddleware as RequestHandler, getSlackConfigById as RequestHandler);
router.post('/', authMiddleware as RequestHandler, createSlackConfig as RequestHandler);
router.put('/:id', authMiddleware as RequestHandler, updateSlackConfig as RequestHandler);
router.delete('/:id', authMiddleware as RequestHandler, deleteSlackConfig as RequestHandler);

// Test connection
router.post('/test', authMiddleware as RequestHandler, testSlackConnection as RequestHandler);

// Slack API operations
router.get('/users/lookup', authMiddleware as RequestHandler, getSlackUserByEmail as RequestHandler);
router.post('/messages/send', authMiddleware as RequestHandler, sendDirectMessage as RequestHandler);
router.post('/messages/send-by-email', authMiddleware as RequestHandler, sendDirectMessageByEmail as RequestHandler);

export default router;
