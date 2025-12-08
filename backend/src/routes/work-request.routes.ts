import { Router, RequestHandler } from 'express';
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

const router = Router();

// All routes require authentication
router.use(authMiddleware as RequestHandler);

// Get team work requests
router.get('/team', getTeamWorkRequests as RequestHandler);

// Get all work requests (Admin only)
router.get('/all', getAllWorkRequests as RequestHandler);

// Get all work requests
router.get('/', getWorkRequests as RequestHandler);

// Get a single work request
router.get('/:id', getWorkRequestById as RequestHandler);

// Create a work request
router.post('/', createWorkRequest as RequestHandler);

// Update a work request
router.put('/:id', updateWorkRequest as RequestHandler);

// Recall a work request
router.post('/:id/recall', recallWorkRequest as RequestHandler);

// Resubmit a work request (from REJECTED or IN_NEGOTIATION)
router.post('/:id/resubmit', resubmitWorkRequest as RequestHandler);

// Approve a work request
router.post('/:id/approve', approveWorkRequest as RequestHandler);

// Unapprove a work request (only approver)
router.post('/:id/unapprove', unapproveWorkRequest as RequestHandler);

// Assign to individual (team PM/PO only)
router.post('/:id/assign', assignToIndividual as RequestHandler);

// Reject a work request
router.post('/:id/reject', rejectWorkRequest as RequestHandler);

// Request negotiation
router.post('/:id/negotiate', requestNegotiation as RequestHandler);

// Create action from work request
router.post('/:id/create-action', createActionFromWorkRequest as RequestHandler);

// Validate action creation (check hierarchy)
router.get('/:id/validate-action-creation', validateActionCreation as RequestHandler);

// Create hierarchy request (SERVICE or TEAM)
router.post('/hierarchy-request', createHierarchyRequest as RequestHandler);

// Link created hierarchy to work request
router.patch('/:id/link-hierarchy', linkCreatedHierarchy as RequestHandler);

// Forward work request to another user
router.post('/:id/forward', forwardWorkRequest as RequestHandler);

// Cancel work request (assignee only, for IN_NEGOTIATION or REJECTED status)
router.post('/:id/cancel', cancelWorkRequest as RequestHandler);

// Delete a work request
router.delete('/:id', deleteWorkRequest as RequestHandler);

// Admin force delete a work request
router.delete('/:id/admin', adminDeleteWorkRequest as RequestHandler);

export default router;
