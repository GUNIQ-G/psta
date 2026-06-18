import { Router } from 'express';
import { getInstallStatus, testDbConnection, runInstall } from '../controllers/install.controller';

const router = Router();

router.get('/status', getInstallStatus);
router.post('/test-db', testDbConnection);
router.post('/run', runInstall);

export default router;
