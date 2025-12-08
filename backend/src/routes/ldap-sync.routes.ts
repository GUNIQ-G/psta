import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  triggerSync,
  getLastSyncResult,
  getSyncStats,
  previewLdapUsers,
  selectiveSync,
  previewHierarchicalLdap,
  applySelectedLdapItems,
} from '../controllers/ldap-sync.controller';

const router = Router();

/**
 * POST /api/ldap-sync/sync
 * Manually trigger LDAP sync
 * Body: { dryRun?: boolean }
 */
router.post('/sync', authMiddleware as any, triggerSync as any);

/**
 * GET /api/ldap-sync/last-result
 * Get last sync result
 */
router.get('/last-result', authMiddleware as any, getLastSyncResult as any);

/**
 * GET /api/ldap-sync/stats
 * Get sync statistics
 */
router.get('/stats', authMiddleware as any, getSyncStats as any);

/**
 * GET /api/ldap-sync/preview
 * Preview LDAP users before sync
 */
router.get('/preview', authMiddleware as any, previewLdapUsers as any);

/**
 * POST /api/ldap-sync/selective
 * Selective sync - sync only selected users
 * Body: { selectedUserDns: string[], dryRun?: boolean }
 */
router.post('/selective', authMiddleware as any, selectiveSync as any);

/**
 * v1.1.19: GET /api/ldap-sync/preview-hierarchical
 * Preview hierarchical LDAP structure with organizations and users
 */
router.get('/preview-hierarchical', authMiddleware as any, previewHierarchicalLdap as any);

/**
 * v1.1.19: POST /api/ldap-sync/apply
 * Apply selected LDAP items (organizations and users) to PSTA
 * Body: { selectedKeys: string[], dryRun?: boolean }
 */
router.post('/apply', authMiddleware as any, applySelectedLdapItems as any);

export default router;
