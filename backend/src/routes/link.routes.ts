import { Router, RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as linkController from '../controllers/link.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware as RequestHandler);

// Create link for item
router.post('/', linkController.createLink as RequestHandler);

// Get links for an item
router.get('/item/:itemId', linkController.getItemLinks as RequestHandler);

// Get all links with hierarchy
router.get('/', linkController.getAllLinks as RequestHandler);

// Fetch title from URL (for auto-fill)
router.get('/fetch-title', linkController.fetchTitle as RequestHandler);

// Delete link (only ADMIN or creator)
router.delete('/:id', linkController.deleteLink as RequestHandler);

export default router;
