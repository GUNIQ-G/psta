import express, { RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import { uploadItemFile } from '../config/multer';
import * as fileController from '../controllers/file.controller';
import * as linkController from '../controllers/link.controller';

const router = express.Router();

router.use(authMiddleware as RequestHandler);

// ── Files: 파일 첨부 ──────────────────────────────────────────────────────
// (구: /api/files/*)
router.post('/files/upload',               uploadItemFile.single('file'), fileController.uploadFile as RequestHandler);
router.get('/files/hierarchical/:itemId',  fileController.getHierarchicalDocuments as RequestHandler);
router.get('/files/item/:itemId',          fileController.getItemFiles as RequestHandler);
router.get('/files',                       fileController.getAllFiles as RequestHandler);
router.delete('/files/:id',               fileController.deleteFile as RequestHandler);

// ── Links: 링크 첨부 ──────────────────────────────────────────────────────
// (구: /api/links/*)
router.get('/links/fetch-title',           linkController.fetchTitle as RequestHandler);
router.get('/links/item/:itemId',          linkController.getItemLinks as RequestHandler);
router.get('/links',                       linkController.getAllLinks as RequestHandler);
router.post('/links',                      linkController.createLink as RequestHandler);
router.delete('/links/:id',               linkController.deleteLink as RequestHandler);

export default router;
