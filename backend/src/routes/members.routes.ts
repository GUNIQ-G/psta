import { Router, RequestHandler, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import * as m from '../controllers/members.controller';

const router = Router();

router.use(authMiddleware as RequestHandler);

const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if ((req as AuthRequest).user?.role !== 'ADMIN') {
    return res.status(403).json({ error: '관리자만 접근 가능합니다.' });
  }
  next();
};

router.get('/', adminOnly, m.listMembers as RequestHandler);
router.post('/', adminOnly, m.createMember as RequestHandler);
router.put('/profile', m.updateProfile as RequestHandler);
router.put('/:id', adminOnly, m.updateMember as RequestHandler);
router.put('/:id/toggle-active', adminOnly, m.toggleActive as RequestHandler);
router.post('/:id/reset-password', adminOnly, m.resetPassword as RequestHandler);

export default router;
