import express, { RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as commentController from '../controllers/comment.controller';
import { uploadFeedbackImage } from '../config/multer';
import {
  getAllFeedbacks,
  getFeedbackById,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  getFeedbackStats,
  uploadImage,
  getImage,
} from '../controllers/feedback.controller';

const router = express.Router();

// ── Comments: 아이템 댓글 ─────────────────────────────────────────────────
// (구: /api/comments/*)
router.get('/comments/item/:itemId',  authMiddleware as RequestHandler, commentController.getCommentsByItem as RequestHandler);
router.post('/comments/item/:itemId', authMiddleware as RequestHandler, commentController.createComment as RequestHandler);
router.delete('/comments/:id',        authMiddleware as RequestHandler, commentController.deleteComment as RequestHandler);
router.post('/comments/:id/reaction', authMiddleware as RequestHandler, commentController.toggleReaction as RequestHandler);

// ── Feedbacks: 버그/건의 게시판 ───────────────────────────────────────────
// (구: /api/feedbacks/*)
// Public route (에디터 이미지 표시용 - 인증 불필요)
router.get('/feedbacks/images/:filename', getImage as RequestHandler);
router.get('/feedbacks/stats',            authMiddleware as RequestHandler, getFeedbackStats as RequestHandler);
router.get('/feedbacks',                  authMiddleware as RequestHandler, getAllFeedbacks as RequestHandler);
router.get('/feedbacks/:id',              authMiddleware as RequestHandler, getFeedbackById as RequestHandler);
router.post('/feedbacks/upload-image',    authMiddleware as RequestHandler, uploadFeedbackImage.single('image'), uploadImage as RequestHandler);
router.post('/feedbacks',                 authMiddleware as RequestHandler, createFeedback as RequestHandler);
router.put('/feedbacks/:id',              authMiddleware as RequestHandler, updateFeedback as RequestHandler);
router.delete('/feedbacks/:id',           authMiddleware as RequestHandler, deleteFeedback as RequestHandler);

export default router;
