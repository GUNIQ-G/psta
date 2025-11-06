import { Router } from 'express';
import * as ldapConfigController from '../controllers/ldap-config.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware as any, ldapConfigController.getAllLdapConfigs as any);
router.get('/:id', authMiddleware as any, ldapConfigController.getLdapConfig as any);
router.post('/', authMiddleware as any, ldapConfigController.createLdapConfig as any);
router.put('/:id', authMiddleware as any, ldapConfigController.updateLdapConfig as any);
router.delete('/:id', authMiddleware as any, ldapConfigController.deleteLdapConfig as any);
router.post('/:id/test', authMiddleware as any, ldapConfigController.testLdapConfig as any);

export default router;
