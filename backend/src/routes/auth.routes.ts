import { Router, RequestHandler } from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/login', authController.login as RequestHandler);
router.get('/me', authMiddleware as RequestHandler, authController.me as RequestHandler);
router.post('/request-approval', authMiddleware as RequestHandler, authController.requestApproval as RequestHandler);

export default router;