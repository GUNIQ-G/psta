import express, { RequestHandler } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getWorkRequests,
  getWorkRequestById,
  createWorkRequest,
  updateWorkRequest,
  deleteWorkRequest,
  recallWorkRequest,
  resubmitWorkRequest,
  approveWorkRequest,
  unapproveWorkRequest,
  createActionFromWorkRequest,
  getTeamWorkRequests,
  assignToIndividual,
  rejectWorkRequest,
  requestNegotiation,
  validateActionCreation,
  createHierarchyRequest,
  linkCreatedHierarchy,
  forwardWorkRequest,
  getAllWorkRequests,
  cancelWorkRequest,
  adminDeleteWorkRequest,
} from '../controllers/work-request.controller';
import {
  createSnapshot,
  getSnapshots,
  getSnapshotById,
  deleteSnapshot,
} from '../controllers/report-snapshot.controller';

const router = express.Router();

router.use(authMiddleware as RequestHandler);

// ── Work Requests: 업무 요청 ──────────────────────────────────────────────
// (구: /api/work-requests/*)
router.get('/requests/team',                       getTeamWorkRequests as RequestHandler);
router.get('/requests/all',                        getAllWorkRequests as RequestHandler);
router.post('/requests/hierarchy-request',         createHierarchyRequest as RequestHandler);
router.get('/requests',                            getWorkRequests as RequestHandler);
router.post('/requests',                           createWorkRequest as RequestHandler);
router.get('/requests/:id',                        getWorkRequestById as RequestHandler);
router.put('/requests/:id',                        updateWorkRequest as RequestHandler);
router.delete('/requests/:id',                     deleteWorkRequest as RequestHandler);
router.post('/requests/:id/recall',                recallWorkRequest as RequestHandler);
router.post('/requests/:id/resubmit',              resubmitWorkRequest as RequestHandler);
router.post('/requests/:id/approve',               approveWorkRequest as RequestHandler);
router.post('/requests/:id/unapprove',             unapproveWorkRequest as RequestHandler);
router.post('/requests/:id/assign',                assignToIndividual as RequestHandler);
router.post('/requests/:id/reject',                rejectWorkRequest as RequestHandler);
router.post('/requests/:id/negotiate',             requestNegotiation as RequestHandler);
router.post('/requests/:id/create-action',         createActionFromWorkRequest as RequestHandler);
router.get('/requests/:id/validate-action-creation', validateActionCreation as RequestHandler);
router.patch('/requests/:id/link-hierarchy',       linkCreatedHierarchy as RequestHandler);
router.post('/requests/:id/forward',               forwardWorkRequest as RequestHandler);
router.post('/requests/:id/cancel',                cancelWorkRequest as RequestHandler);
router.delete('/requests/:id/admin',               adminDeleteWorkRequest as RequestHandler);

// ── Report Snapshots: 보고 스냅샷 ────────────────────────────────────────
// (구: /api/report-snapshots/*)
router.post('/snapshots',    createSnapshot as RequestHandler);
router.get('/snapshots',     getSnapshots as RequestHandler);
router.get('/snapshots/:id', getSnapshotById as RequestHandler);
router.delete('/snapshots/:id', deleteSnapshot as RequestHandler);

export default router;
