import { Router, RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
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

const router = Router();

// Public routes (no authentication required)
// Get all system settings (needed for login page)
router.get('/', getSystemSettings as RequestHandler);

// Get a specific setting (needed for login page)
router.get('/:key', getSettingByKey as RequestHandler);

// Protected routes (authentication required)
// Update multiple settings at once
router.put('/', authMiddleware as RequestHandler, updateSettings as RequestHandler);

// Upload system logo
router.post('/upload-logo', authMiddleware as RequestHandler, uploadSystemLogo.single('logo'), uploadLogo as RequestHandler);

// Delete system logo
router.delete('/logo', authMiddleware as RequestHandler, deleteLogo as RequestHandler);

// Upload favicon
router.post('/upload-favicon', authMiddleware as RequestHandler, uploadSystemLogo.single('favicon'), uploadFavicon as RequestHandler);

// Delete favicon
router.delete('/favicon', authMiddleware as RequestHandler, deleteFavicon as RequestHandler);

// Update a specific setting
router.put('/:key', authMiddleware as RequestHandler, updateSetting as RequestHandler);

export default router;
