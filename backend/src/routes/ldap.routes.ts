import { Router, RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';

// Controllers
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

import * as ldapConfigController from '../controllers/ldap-config.controller';

import {
  triggerSync,
  getLastSyncResult,
  getSyncStats,
  previewLdapUsers,
  selectiveSync,
  previewHierarchicalLdap,
  applySelectedLdapItems,
} from '../controllers/ldap-sync.controller';

import * as settingsController from '../controllers/settings.controller';

const router = Router();

router.use(authMiddleware as RequestHandler);

// ── Admin: LDAP 서버 사용자/그룹 직접 관리 ──────────────────────────────
// (구: /api/ldap-admin/*)
router.get('/admin/users',                   getAllLdapUsers as RequestHandler);
router.post('/admin/users',                  createLdapUser as RequestHandler);
router.put('/admin/users/:dn',               updateLdapUser as RequestHandler);
router.delete('/admin/users/:dn',            deleteLdapUser as RequestHandler);

router.get('/admin/groups',                  getAllLdapGroups as RequestHandler);
router.post('/admin/groups',                 createLdapGroup as RequestHandler);
router.put('/admin/groups/:dn',              updateLdapGroup as RequestHandler);
router.delete('/admin/groups/:dn',           deleteLdapGroup as RequestHandler);
router.post('/admin/groups/add-member',      addUserToGroup as RequestHandler);
router.post('/admin/groups/remove-member',   removeUserFromGroup as RequestHandler);

// ── Configs: LDAP 서버 연결 설정 CRUD ────────────────────────────────────
// (구: /api/ldap-configs/*)
router.get('/configs',                       ldapConfigController.getAllLdapConfigs as RequestHandler);
router.post('/configs/test-connection',      ldapConfigController.testLdapConnection as RequestHandler);
router.get('/configs/:id',                   ldapConfigController.getLdapConfig as RequestHandler);
router.post('/configs',                      ldapConfigController.createLdapConfig as RequestHandler);
router.put('/configs/:id',                   ldapConfigController.updateLdapConfig as RequestHandler);
router.delete('/configs/:id',                ldapConfigController.deleteLdapConfig as RequestHandler);
router.post('/configs/:id/test',             ldapConfigController.testLdapConfig as RequestHandler);

// ── Sync: LDAP → PSTA 동기화 ─────────────────────────────────────────────
// (구: /api/ldap-sync/*)
router.post('/sync',                         triggerSync as RequestHandler);
router.get('/sync/last-result',              getLastSyncResult as RequestHandler);
router.get('/sync/stats',                    getSyncStats as RequestHandler);
router.get('/sync/preview',                  previewLdapUsers as RequestHandler);
router.post('/sync/selective',               selectiveSync as RequestHandler);
router.get('/sync/preview-hierarchical',     previewHierarchicalLdap as RequestHandler);
router.post('/sync/apply',                   applySelectedLdapItems as RequestHandler);

// ── Settings: LDAP 인증 설정 ──────────────────────────────────────────────
// (구: /api/settings/ldap/*)
router.get('/settings',                      settingsController.getLdapSettings as RequestHandler);
router.put('/settings',                      settingsController.updateLdapSettings as RequestHandler);
router.post('/settings/test',                settingsController.testLdapConnection as RequestHandler);

export default router;
