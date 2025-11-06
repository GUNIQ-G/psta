import { Router, RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import { uploadItemFile } from '../config/multer';
import * as fileController from '../controllers/file.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware as RequestHandler);

// Upload file to item
router.post('/upload', uploadItemFile.single('file'), fileController.uploadFile as RequestHandler);

// Get files for an item
router.get('/item/:itemId', fileController.getItemFiles as RequestHandler);

// Get hierarchical documents (files + links) for an item and its descendants
router.get('/hierarchical/:itemId', fileController.getHierarchicalDocuments as RequestHandler);

// Get all files with hierarchy
router.get('/', fileController.getAllFiles as RequestHandler);

// Delete file (only ADMIN or uploader)
router.delete('/:id', fileController.deleteFile as RequestHandler);

export default router;
