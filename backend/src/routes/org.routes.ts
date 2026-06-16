import express, { RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as teamController from '../controllers/team.controller';
import {
  getOrganizationTree,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  addMemberToOrganization,
  removeMemberFromOrganization,
  syncFromLdap,
} from '../controllers/organization.controller';

const router = express.Router();

router.use(authMiddleware as RequestHandler);

// ── Teams: 프로젝트 팀 ────────────────────────────────────────────────────
// (구: /api/teams/*)
router.get('/teams',                    teamController.getAllTeams as RequestHandler);
router.get('/teams/hierarchy',          teamController.getTeamHierarchy as RequestHandler);
router.post('/teams/sync-ldap',         teamController.syncFromLDAP as RequestHandler);
router.post('/teams/reset',             teamController.resetTeams as RequestHandler);
router.get('/teams/:id',                teamController.getTeamById as RequestHandler);
router.get('/teams/:id/members',        teamController.getTeamMembers as RequestHandler);
router.post('/teams',                   teamController.createTeam as RequestHandler);
router.put('/teams/:id',                teamController.updateTeam as RequestHandler);
router.delete('/teams/:id',             teamController.deleteTeam as RequestHandler);

// ── Units: 조직 구조 (회사/부서/팀) ──────────────────────────────────────
// (구: /api/organizations/*)
router.get('/units/tree',               getOrganizationTree as RequestHandler);
router.post('/units/add-member',        addMemberToOrganization as RequestHandler);
router.post('/units/remove-member',     removeMemberFromOrganization as RequestHandler);
router.post('/units/sync-from-ldap',    syncFromLdap as RequestHandler);
router.get('/units/:id',                getOrganizationById as RequestHandler);
router.post('/units',                   createOrganization as RequestHandler);
router.put('/units/:id',                updateOrganization as RequestHandler);
router.delete('/units/:id',             deleteOrganization as RequestHandler);

export default router;
