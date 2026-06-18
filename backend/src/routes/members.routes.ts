import { Router, RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as m from '../controllers/members.controller';

const router = Router();

router.use(authMiddleware as RequestHandler);

router.get('/', m.listMembers as RequestHandler);
router.post('/', m.createMember as RequestHandler);
router.put('/profile', m.updateProfile as RequestHandler);
router.put('/:id', m.updateMember as RequestHandler);
router.put('/:id/toggle-active', m.toggleActive as RequestHandler);
router.post('/:id/reset-password', m.resetPassword as RequestHandler);

export default router;
