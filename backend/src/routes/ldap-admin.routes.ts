import express, { RequestHandler } from 'express';
import {
  getAllLdapUsers,
  getAllLdapGroups,
  createLdapUser,
  updateLdapUser,
  deleteLdapUser,
  createLdapGroup,
  updateLdapGroup,
  deleteLdapGroup,
  addUserToGroup,
  removeUserFromGroup,
} from '../controllers/ldap-admin.controller';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// All routes require authentication and admin role
// User routes
router.get('/users', authMiddleware as RequestHandler, getAllLdapUsers as RequestHandler);
router.post('/users', authMiddleware as RequestHandler, createLdapUser as RequestHandler);
router.put('/users/:dn', authMiddleware as RequestHandler, updateLdapUser as RequestHandler);
router.delete('/users/:dn', authMiddleware as RequestHandler, deleteLdapUser as RequestHandler);

// Group routes
router.get('/groups', authMiddleware as RequestHandler, getAllLdapGroups as RequestHandler);
router.post('/groups', authMiddleware as RequestHandler, createLdapGroup as RequestHandler);
router.put('/groups/:dn', authMiddleware as RequestHandler, updateLdapGroup as RequestHandler);
router.delete('/groups/:dn', authMiddleware as RequestHandler, deleteLdapGroup as RequestHandler);

// Group membership routes
router.post('/groups/add-member', authMiddleware as RequestHandler, addUserToGroup as RequestHandler);
router.post('/groups/remove-member', authMiddleware as RequestHandler, removeUserFromGroup as RequestHandler);

export default router;
