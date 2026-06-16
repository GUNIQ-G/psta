import { Router, RequestHandler } from 'express';
import express from 'express';
import { authMiddleware } from '../middleware/auth';
import * as notificationController from '../controllers/notification.controller';
import {
  getAllNotificationApps,
  getNotificationAppById,
  createNotificationApp,
  updateNotificationApp,
  deleteNotificationApp,
  testConnection,
  sendMessageByEmail,
} from '../controllers/notification-app.controller';
import * as messageController from '../controllers/message.controller';

const router = express.Router();

router.use(authMiddleware as RequestHandler);

// ── Notifications: 사용자 알림 ────────────────────────────────────────────
// (구: /api/notifications/*)
router.get('/',                notificationController.getMyNotifications as RequestHandler);
router.get('/unread-count',    notificationController.getUnreadCount as RequestHandler);
router.put('/read-all',        notificationController.markAllAsRead as RequestHandler);
router.put('/:id/read',        notificationController.markAsRead as RequestHandler);

// ── Apps: 알림 앱 (Slack/Telegram 등) ────────────────────────────────────
// (구: /api/notification-apps/*)
router.get('/apps',            getAllNotificationApps as RequestHandler);
router.post('/apps/test',      testConnection as RequestHandler);
router.post('/apps/messages/send-by-email', sendMessageByEmail as RequestHandler);
router.get('/apps/:id',        getNotificationAppById as RequestHandler);
router.post('/apps',           createNotificationApp as RequestHandler);
router.put('/apps/:id',        updateNotificationApp as RequestHandler);
router.delete('/apps/:id',     deleteNotificationApp as RequestHandler);

// ── Messages: DM 메시지 ───────────────────────────────────────────────────
// (구: /api/messages/*)
router.get('/messages/received',    messageController.getReceivedMessages as RequestHandler);
router.get('/messages/sent',        messageController.getSentMessages as RequestHandler);
router.get('/messages/unread-count', messageController.getUnreadCount as RequestHandler);
router.post('/messages',            messageController.sendMessage as RequestHandler);
router.get('/messages/:id',         messageController.getMessageById as RequestHandler);
router.put('/messages/:id/read',    messageController.markAsRead as RequestHandler);
router.delete('/messages/:id',      messageController.deleteMessage as RequestHandler);

export default router;
