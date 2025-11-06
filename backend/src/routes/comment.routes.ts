import { Router, RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as commentController from '../controllers/comment.controller';

const router = Router();

router.use(authMiddleware as RequestHandler);

router.get('/item/:itemId', commentController.getCommentsByItem as RequestHandler);
router.post('/item/:itemId', commentController.createComment as RequestHandler);
router.delete('/:id', commentController.deleteComment as RequestHandler);
router.post('/:id/reaction', commentController.toggleReaction as RequestHandler);

export default router;
