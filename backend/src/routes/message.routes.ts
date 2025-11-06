import { Router, RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as messageController from '../controllers/message.controller';

const router = Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authMiddleware as RequestHandler);

// 받은 메시지 목록
router.get('/received', messageController.getReceivedMessages as RequestHandler);

// 보낸 메시지 목록
router.get('/sent', messageController.getSentMessages as RequestHandler);

// 읽지 않은 메시지 개수
router.get('/unread-count', messageController.getUnreadCount as RequestHandler);

// 메시지 상세 조회
router.get('/:id', messageController.getMessageById as RequestHandler);

// 메시지 전송
router.post('/', messageController.sendMessage as RequestHandler);

// 메시지 읽음 처리
router.put('/:id/read', messageController.markAsRead as RequestHandler);

// 메시지 삭제
router.delete('/:id', messageController.deleteMessage as RequestHandler);

export default router;
