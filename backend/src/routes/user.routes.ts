import { Router, RequestHandler } from 'express';
import * as userController from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware as any, userController.getAllUsers);
router.get('/pending', authMiddleware as any, userController.getPendingUsers);
router.get('/pending-approval', authMiddleware as any, userController.getPendingApprovals);
router.get('/team/:teamId/members', authMiddleware as any, userController.getTeamMembers);
router.post('/sync-all-ldap', authMiddleware as any, userController.syncAllUsersFromLDAP);
router.get('/:userId/managers', authMiddleware as RequestHandler, userController.getUserManagers as RequestHandler);
router.get('/:id', authMiddleware as any, userController.getUserById);
router.put('/:id', authMiddleware as any, userController.updateUser);
router.post('/:id/verify', authMiddleware as any, userController.verifyUser);
router.post('/:id/approve', authMiddleware as any, userController.approveUser);
router.post('/:id/reject', authMiddleware as any, userController.rejectUser);
router.post('/:id/sync-ldap', authMiddleware as any, userController.syncUserFromLDAP);
router.delete('/:id', authMiddleware as any, userController.deleteUser);
router.post('/:id/assign-team', authMiddleware as any, userController.assignToTeam);
router.post('/:id/remove-team', authMiddleware as any, userController.removeFromTeam);

export default router;
