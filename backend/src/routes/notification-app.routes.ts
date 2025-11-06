import express, { RequestHandler } from 'express';
import {
  getAllNotificationApps,
  getNotificationAppById,
  createNotificationApp,
  updateNotificationApp,
  deleteNotificationApp,
  testConnection,
  sendMessageByEmail,
} from '../controllers/notification-app.controller';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// CRUD routes
router.get('/', authMiddleware as RequestHandler, getAllNotificationApps as RequestHandler);
router.get('/:id', authMiddleware as RequestHandler, getNotificationAppById as RequestHandler);
router.post('/', authMiddleware as RequestHandler, createNotificationApp as RequestHandler);
router.put('/:id', authMiddleware as RequestHandler, updateNotificationApp as RequestHandler);
router.delete('/:id', authMiddleware as RequestHandler, deleteNotificationApp as RequestHandler);

// Test connection
router.post('/test', authMiddleware as RequestHandler, testConnection as RequestHandler);

// Send message
router.post('/messages/send-by-email', authMiddleware as RequestHandler, sendMessageByEmail as RequestHandler);

export default router;
