import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import ldapSyncService from '../services/ldap-sync.service';
import { appLogger, errorLogger } from '../config/logger';

/**
 * Manually trigger LDAP sync
 * POST /api/ldap-sync/sync
 */
export const triggerSync = async (req: AuthRequest, res: Response) => {
  try {
    // Check admin permission
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    const { dryRun } = req.body;

    appLogger.info('Manual LDAP sync triggered', {
      userId: req.user.id,
      username: req.user.username,
      dryRun: dryRun || false,
    });

    const result = await ldapSyncService.syncFromLdap(dryRun || false);

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    errorLogger.error('Manual LDAP sync failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get last sync result
 * GET /api/ldap-sync/last-result
 */
export const getLastSyncResult = async (req: AuthRequest, res: Response) => {
  try {
    // Check admin permission
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    const result = await ldapSyncService.getLastSyncResult();

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    errorLogger.error('Failed to get last sync result', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get sync statistics
 * GET /api/ldap-sync/stats
 */
export const getSyncStats = async (req: AuthRequest, res: Response) => {
  try {
    // Check admin permission
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    const stats = await ldapSyncService.getSyncStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    errorLogger.error('Failed to get sync stats', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
