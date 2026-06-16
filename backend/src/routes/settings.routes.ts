import express, { RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as settingsController from '../controllers/settings.controller';
import {
  getSystemSettings,
  getSettingByKey,
  updateSetting,
  updateSettings,
  uploadLogo,
  deleteLogo,
  uploadFavicon,
  deleteFavicon,
} from '../controllers/system-settings.controller';
import { uploadSystemLogo } from '../config/multer';

const router = express.Router();

// ── Slack settings ────────────────────────────────────────────────────────
// (구: /api/settings/slack)
router.get('/slack', authMiddleware as RequestHandler, settingsController.getSlackSettings as RequestHandler);
router.put('/slack', authMiddleware as RequestHandler, settingsController.updateSlackSettings as RequestHandler);

// ── System settings ───────────────────────────────────────────────────────
// (구: /api/system-settings/*)
// Public routes (로그인 페이지에서 인증 없이 사용)
router.get('/system', getSystemSettings as RequestHandler);
router.put('/system', authMiddleware as RequestHandler, updateSettings as RequestHandler);
router.post('/system/upload-logo', authMiddleware as RequestHandler, uploadSystemLogo.single('logo'), uploadLogo as RequestHandler);
router.delete('/system/logo', authMiddleware as RequestHandler, deleteLogo as RequestHandler);
router.post('/system/upload-favicon', authMiddleware as RequestHandler, uploadSystemLogo.single('favicon'), uploadFavicon as RequestHandler);
router.delete('/system/favicon', authMiddleware as RequestHandler, deleteFavicon as RequestHandler);
router.get('/system/:key', getSettingByKey as RequestHandler);
router.put('/system/:key', authMiddleware as RequestHandler, updateSetting as RequestHandler);

export default router;
