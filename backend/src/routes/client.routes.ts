import { Router, RequestHandler } from 'express';
import * as clientController from '../controllers/client.controller';
import { authMiddleware } from '../middleware/auth';
import { uploadClientLogo } from '../config/multer';

const router = Router();

router.use(authMiddleware as RequestHandler);

router.get('/', clientController.getClients as RequestHandler);
router.post('/', clientController.createClient as RequestHandler);
router.put('/:id', clientController.updateClient as RequestHandler);
router.delete('/:id', clientController.deleteClient as RequestHandler);
router.post('/upload-logo', uploadClientLogo.single('logo'), clientController.uploadClientLogo as RequestHandler);

export default router;