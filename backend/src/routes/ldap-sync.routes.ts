import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  triggerSync,
  getLastSyncResult,
  getSyncStats,
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

export default router;
