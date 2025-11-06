import { Router, RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as notificationController from '../controllers/notification.controller';

const router = Router();

router.use(authMiddleware as RequestHandler);

router.get('/', notificationController.getMyNotifications as RequestHandler);
router.get('/unread-count', notificationController.getUnreadCount as RequestHandler);
router.put('/:id/read', notificationController.markAsRead as RequestHandler);
router.put('/read-all', notificationController.markAllAsRead as RequestHandler);

export default router;
