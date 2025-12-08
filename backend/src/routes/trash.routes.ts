import { Router, RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getTrashItems,
  restoreTrashItem,
  permanentlyDeleteTrashItem,
} from '../controllers/trash.controller';

const router = Router();

// 모든 휴지통 라우트는 인증 필요
router.use(authMiddleware as RequestHandler);

/**
 * GET /api/trash
 * 휴지통 항목 조회 (관리자 전용)
 * Query params: type, limit, offset
 */
router.get('/', getTrashItems as RequestHandler);

/**
 * POST /api/trash/:id/restore
 * 항목 복원 (관리자 전용)
 */
router.post('/:id/restore', restoreTrashItem as RequestHandler);

/**
 * DELETE /api/trash/:id
 * 항목 영구 삭제 (관리자 전용)
 */
router.delete('/:id', permanentlyDeleteTrashItem as RequestHandler);

export default router;
