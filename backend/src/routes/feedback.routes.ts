import { Router, RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import { uploadFeedbackImage } from '../config/multer';
import {
  getAllFeedbacks,
  getFeedbackById,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  getFeedbackStats,
  uploadImage,
  getImage,
} from '../controllers/feedback.controller';

const router = Router();

// Public route - Get feedback image (no auth required for displaying in editor)
router.get('/images/:filename', getImage as RequestHandler);

// All other routes require authentication
router.use(authMiddleware as RequestHandler);

// Get all feedbacks (with filtering)
router.get('/', getAllFeedbacks as RequestHandler);

// Get feedback statistics
router.get('/stats', getFeedbackStats as RequestHandler);

// Get feedback by ID
router.get('/:id', getFeedbackById as RequestHandler);

// Create new feedback
router.post('/', createFeedback as RequestHandler);

// Upload image for feedback content
router.post('/upload-image', uploadFeedbackImage.single('image'), uploadImage as RequestHandler);

// Update feedback
router.put('/:id', updateFeedback as RequestHandler);

// Delete feedback
router.delete('/:id', deleteFeedback as RequestHandler);

export default router;
