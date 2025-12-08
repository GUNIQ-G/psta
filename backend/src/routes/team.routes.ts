import { Router } from 'express';
import * as teamController from '../controllers/team.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware as any, teamController.getAllTeams);
router.get('/hierarchy', authMiddleware as any, teamController.getTeamHierarchy); // v1.1.18: Hierarchical structure
router.get('/:id', authMiddleware as any, teamController.getTeamById);
router.get('/:id/members', authMiddleware as any, teamController.getTeamMembers);
router.post('/', authMiddleware as any, teamController.createTeam);
router.put('/:id', authMiddleware as any, teamController.updateTeam);
router.delete('/:id', authMiddleware as any, teamController.deleteTeam);
router.post('/sync-ldap', authMiddleware as any, teamController.syncFromLDAP);

/**
 * POST /api/teams/reset
 * v1.1.19: Reset all teams (organization initialization)
 * Requires admin role and password verification
 */
router.post('/reset', authMiddleware as any, teamController.resetTeams as any);

export default router;
