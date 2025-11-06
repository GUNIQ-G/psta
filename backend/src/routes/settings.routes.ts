import { Router, RequestHandler } from 'express';
import * as settingsController from '../controllers/settings.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware as RequestHandler);

// LDAP settings
router.get('/ldap', settingsController.getLdapSettings as RequestHandler);
router.put('/ldap', settingsController.updateLdapSettings as RequestHandler);
router.post('/ldap/test', settingsController.testLdapConnection as RequestHandler);

// Slack settings
router.get('/slack', settingsController.getSlackSettings as RequestHandler);
router.put('/slack', settingsController.updateSlackSettings as RequestHandler);

export default router;
