import express, { RequestHandler } from 'express';
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
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.get('/tree', authMiddleware as RequestHandler, getOrganizationTree as RequestHandler);
router.get('/:id', authMiddleware as RequestHandler, getOrganizationById as RequestHandler);
router.post('/', authMiddleware as RequestHandler, createOrganization as RequestHandler);
router.put('/:id', authMiddleware as RequestHandler, updateOrganization as RequestHandler);
router.delete('/:id', authMiddleware as RequestHandler, deleteOrganization as RequestHandler);

// Member management
router.post('/add-member', authMiddleware as RequestHandler, addMemberToOrganization as RequestHandler);
router.post('/remove-member', authMiddleware as RequestHandler, removeMemberFromOrganization as RequestHandler);

// LDAP synchronization
router.post('/sync-from-ldap', authMiddleware as RequestHandler, syncFromLdap as RequestHandler);

export default router;
