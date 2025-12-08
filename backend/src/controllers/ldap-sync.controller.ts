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

/**
 * Preview LDAP users before sync
 * GET /api/ldap-sync/preview
 */
export const previewLdapUsers = async (req: AuthRequest, res: Response) => {
  try {
    // Check admin permission
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    appLogger.info('LDAP users preview requested', {
      userId: req.user.id,
      username: req.user.username,
    });

    const preview = await ldapSyncService.previewLdapUsers();

    res.json({
      success: true,
      ...preview,
    });
  } catch (error: any) {
    errorLogger.error('Failed to preview LDAP users', {
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
 * Selective sync - sync only selected users
 * POST /api/ldap-sync/selective
 * Body: { selectedUserDns: string[], dryRun?: boolean }
 */
export const selectiveSync = async (req: AuthRequest, res: Response) => {
  try {
    // Check admin permission
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    const { selectedUserDns, dryRun } = req.body;

    if (!selectedUserDns || !Array.isArray(selectedUserDns)) {
      return res.status(400).json({
        success: false,
        error: 'selectedUserDns must be an array of user DNs',
      });
    }

    if (selectedUserDns.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one user must be selected',
      });
    }

    appLogger.info('Selective LDAP sync triggered', {
      userId: req.user.id,
      username: req.user.username,
      selectedCount: selectedUserDns.length,
      dryRun: dryRun || false,
    });

    const result = await ldapSyncService.selectiveSync(selectedUserDns, dryRun || false);

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    errorLogger.error('Selective LDAP sync failed', {
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
 * v1.1.19: Preview hierarchical LDAP structure with organizations and users
 * GET /api/ldap-sync/preview-hierarchical
 */
export const previewHierarchicalLdap = async (req: AuthRequest, res: Response) => {
  try {
    // Check admin permission
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    appLogger.info('Hierarchical LDAP preview requested', {
      userId: req.user.id,
      username: req.user.username,
    });

    const preview = await ldapSyncService.previewHierarchicalLdap();

    res.json({
      success: true,
      ...preview,
    });
  } catch (error: any) {
    errorLogger.error('Failed to preview hierarchical LDAP', {
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
 * v1.1.19: Apply selected LDAP items (organizations and users) to PSTA
 * POST /api/ldap-sync/apply
 * Body: { selectedKeys: string[], dryRun?: boolean }
 */
export const applySelectedLdapItems = async (req: AuthRequest, res: Response) => {
  try {
    // Check admin permission
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    const { selectedKeys, dryRun } = req.body;

    if (!selectedKeys || !Array.isArray(selectedKeys)) {
      return res.status(400).json({
        success: false,
        error: 'selectedKeys must be an array of keys',
      });
    }

    if (selectedKeys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one item must be selected',
      });
    }

    appLogger.info('Selective LDAP apply triggered', {
      userId: req.user.id,
      username: req.user.username,
      selectedCount: selectedKeys.length,
      dryRun: dryRun || false,
    });

    const result = await ldapSyncService.applySelectedLdapItems(selectedKeys, dryRun || false);

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    errorLogger.error('Selective LDAP apply failed', {
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
