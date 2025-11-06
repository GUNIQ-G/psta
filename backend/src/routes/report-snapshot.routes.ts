import { Router, RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  createSnapshot,
  getSnapshots,
  getSnapshotById,
  deleteSnapshot,
} from '../controllers/report-snapshot.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware as RequestHandler);

// Create a new snapshot
router.post('/', createSnapshot as RequestHandler);

// Get all snapshots (with optional filtering)
router.get('/', getSnapshots as RequestHandler);

// Get a snapshot by ID
router.get('/:id', getSnapshotById as RequestHandler);

// Delete a snapshot
router.delete('/:id', deleteSnapshot as RequestHandler);

export default router;
