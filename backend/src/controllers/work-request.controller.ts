import { Response } from 'express';
import { randomUUID } from 'crypto';
import { WorkRequestStatus, WorkRequestType, ItemType } from '../types/enums';
import { AuthRequest } from '../middleware/auth';
import { NotificationService } from '../services/notification.service';
import { query, queryOne, transaction } from '../config/database';
import appLogger, { errorLogger } from '../config/logger';
import {
  isAssigneeOrTeamMember,
  validateHierarchyForAction,
  fetchWorkRequestWithAssigneeTeam,
  fetchWorkRequestWithStateTransition,
  fetchWorkRequestFull,
} from '../services/work-request.service';

// ─── SQL helper: fetch USER fields ────────────────────────────────────────────
const USER_COLS = `id, username, "displayName", email`;

/**
 * Build a full work request row with all related entities attached.
 * id is the WorkRequest id ($1).
 */
async function buildFullWorkRequest(id: string): Promise<any | null> {
  const wr = await queryOne<any>(
    `SELECT wr.*,
            row_to_json(req.*) AS "Requester",
            row_to_json(asgn.*) AS "Assignee",
            row_to_json(appr.*) AS "ApprovedBy",
            row_to_json(act.*) AS "Action",
            CASE WHEN proj.id IS NOT NULL THEN json_build_object('id', proj.id, 'name', proj.name) ELSE NULL END AS "Project",
            CASE WHEN svc.id IS NOT NULL THEN json_build_object('id', svc.id, 'name', svc.name) ELSE NULL END AS "Service",
            CASE WHEN tm.id IS NOT NULL THEN json_build_object('id', tm.id, 'name', tm.name) ELSE NULL END AS "Team",
            CASE WHEN at.id IS NOT NULL THEN json_build_object('id', at.id, 'name', at.name, 'description', at.description) ELSE NULL END AS "AssigneeTeam"
     FROM "WorkRequest" wr
     LEFT JOIN (SELECT ${USER_COLS} FROM "User") req ON req.id = wr."requesterId"
     LEFT JOIN (SELECT ${USER_COLS} FROM "User") asgn ON asgn.id = wr."assigneeId"
     LEFT JOIN (SELECT ${USER_COLS} FROM "User") appr ON appr.id = wr."approvedById"
     LEFT JOIN "Item" act ON act.id = wr."actionId"
     LEFT JOIN "Item" proj ON proj.id = wr."projectId"
     LEFT JOIN "Item" svc ON svc.id = wr."serviceId"
     LEFT JOIN "Item" tm ON tm.id = wr."teamId"
     LEFT JOIN "Team" at ON at.id = wr."assigneeTeamId"
     WHERE wr.id = $1`,
    [id],
  );
  return wr;
}

/**
 * Build work request with Requester, Assignee, AssigneeTeam, ApprovedBy only
 * (used for state transition responses).
 */
async function buildStateTransitionWorkRequest(id: string): Promise<any | null> {
  return queryOne<any>(
    `SELECT wr.*,
            row_to_json(req.*) AS "Requester",
            row_to_json(asgn.*) AS "Assignee",
            CASE WHEN at.id IS NOT NULL THEN json_build_object('id', at.id, 'name', at.name, 'description', at.description) ELSE NULL END AS "AssigneeTeam",
            row_to_json(appr.*) AS "ApprovedBy"
     FROM "WorkRequest" wr
     LEFT JOIN (SELECT ${USER_COLS} FROM "User") req ON req.id = wr."requesterId"
     LEFT JOIN (SELECT ${USER_COLS} FROM "User") asgn ON asgn.id = wr."assigneeId"
     LEFT JOIN "Team" at ON at.id = wr."assigneeTeamId"
     LEFT JOIN (SELECT ${USER_COLS} FROM "User") appr ON appr.id = wr."approvedById"
     WHERE wr.id = $1`,
    [id],
  );
}

/**
 * Build work request with Requester, Assignee, AssigneeTeam only (create/update response).
 */
async function buildBasicWorkRequest(id: string): Promise<any | null> {
  return queryOne<any>(
    `SELECT wr.*,
            row_to_json(req.*) AS "Requester",
            row_to_json(asgn.*) AS "Assignee",
            CASE WHEN at.id IS NOT NULL THEN json_build_object('id', at.id, 'name', at.name, 'description', at.description) ELSE NULL END AS "AssigneeTeam"
     FROM "WorkRequest" wr
     LEFT JOIN (SELECT ${USER_COLS} FROM "User") req ON req.id = wr."requesterId"
     LEFT JOIN (SELECT ${USER_COLS} FROM "User") asgn ON asgn.id = wr."assigneeId"
     LEFT JOIN "Team" at ON at.id = wr."assigneeTeamId"
     WHERE wr.id = $1`,
    [id],
  );
}

/**
 * Build work request with all fields + Action (including assignee of action).
 */
async function buildWorkRequestWithAction(id: string): Promise<any | null> {
  const wr = await queryOne<any>(
    `SELECT wr.*,
            row_to_json(req.*) AS "Requester",
            row_to_json(asgn.*) AS "Assignee",
            CASE WHEN at.id IS NOT NULL THEN json_build_object('id', at.id, 'name', at.name, 'description', at.description) ELSE NULL END AS "AssigneeTeam",
            row_to_json(appr.*) AS "ApprovedBy",
            row_to_json(act.*) AS "Action"
     FROM "WorkRequest" wr
     LEFT JOIN (SELECT ${USER_COLS} FROM "User") req ON req.id = wr."requesterId"
     LEFT JOIN (SELECT ${USER_COLS} FROM "User") asgn ON asgn.id = wr."assigneeId"
     LEFT JOIN "Team" at ON at.id = wr."assigneeTeamId"
     LEFT JOIN (SELECT ${USER_COLS} FROM "User") appr ON appr.id = wr."approvedById"
     LEFT JOIN "Item" act ON act.id = wr."actionId"
     WHERE wr.id = $1`,
    [id],
  );
  return wr;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

// Get all work requests
export const getWorkRequests = async (req: AuthRequest, res: Response) => {
  try {
    const { status, priority, assigneeId, requesterId } = req.query;

    const conditions: string[] = [`wr."isDeleted" = false`];
    const params: any[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`wr.status = $${idx++}`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`wr.priority = $${idx++}`);
      params.push(priority);
    }
    if (assigneeId) {
      conditions.push(`wr."assigneeId" = $${idx++}`);
      params.push(assigneeId);
    }
    if (requesterId) {
      conditions.push(`wr."requesterId" = $${idx++}`);
      params.push(requesterId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const workRequests = await query<any>(
      `SELECT wr.*,
              row_to_json(req.*) AS "Requester",
              row_to_json(asgn.*) AS "Assignee",
              row_to_json(appr.*) AS "ApprovedBy",
              row_to_json(act.*) AS "Action",
              CASE WHEN proj.id IS NOT NULL THEN json_build_object('id', proj.id, 'name', proj.name) ELSE NULL END AS "Project",
              CASE WHEN svc.id IS NOT NULL THEN json_build_object('id', svc.id, 'name', svc.name) ELSE NULL END AS "Service",
              CASE WHEN tm.id IS NOT NULL THEN json_build_object('id', tm.id, 'name', tm.name) ELSE NULL END AS "Team",
              CASE WHEN at.id IS NOT NULL THEN json_build_object('id', at.id, 'name', at.name, 'description', at.description) ELSE NULL END AS "AssigneeTeam"
       FROM "WorkRequest" wr
       LEFT JOIN (SELECT ${USER_COLS} FROM "User") req ON req.id = wr."requesterId"
       LEFT JOIN (SELECT ${USER_COLS} FROM "User") asgn ON asgn.id = wr."assigneeId"
       LEFT JOIN (SELECT ${USER_COLS} FROM "User") appr ON appr.id = wr."approvedById"
       LEFT JOIN "Item" act ON act.id = wr."actionId"
       LEFT JOIN "Item" proj ON proj.id = wr."projectId"
       LEFT JOIN "Item" svc ON svc.id = wr."serviceId"
       LEFT JOIN "Item" tm ON tm.id = wr."teamId"
       LEFT JOIN "Team" at ON at.id = wr."assigneeTeamId"
       ${whereClause}
       ORDER BY wr.status ASC, wr.priority DESC, wr."createdAt" DESC`,
      params,
    );

    res.json(workRequests);
  } catch (error) {
    errorLogger.error('Get work requests error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a single work request
export const getWorkRequestById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const workRequest = await buildFullWorkRequest(id);

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    res.json(workRequest);
  } catch (error) {
    errorLogger.error('Get work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a work request
export const createWorkRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, description, priority, projectId, serviceId, teamId, dueDate, assigneeId, assigneeTeamId } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    // Validation: At least one of assigneeId or assigneeTeamId must be provided
    if (!assigneeId && !assigneeTeamId) {
      return res.status(400).json({ error: 'Either assigneeId or assigneeTeamId must be provided' });
    }

    const newId = randomUUID();
    const now = new Date();

    await query(
      `INSERT INTO "WorkRequest" (
        id, title, description, priority, status, "projectId", "serviceId", "teamId",
        "dueDate", "requesterId", "assigneeId", "assigneeTeamId", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        newId,
        title,
        description,
        priority || 'MEDIUM',
        'PENDING',
        projectId || null,
        serviceId || null,
        teamId || null,
        dueDate ? new Date(dueDate) : null,
        userId,
        assigneeId || null,
        assigneeTeamId || null,
        now,
        now,
      ],
    );

    const workRequest = await buildBasicWorkRequest(newId);

    // 알림 전송
    NotificationService.notifyWorkRequestCreated({
      workRequestId: workRequest.id,
      title: workRequest.title,
      requesterId: userId,
      assigneeId: workRequest.assigneeId || undefined,
      assigneeTeamId: workRequest.assigneeTeamId || undefined,
    }).catch(err => errorLogger.error('Failed to send notification:', { error: err }));

    res.status(201).json(workRequest);
  } catch (error) {
    errorLogger.error('Create work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a work request
export const updateWorkRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, priority, status, projectId, serviceId, teamId, dueDate, assigneeId, assigneeTeamId, actionId } = req.body;

    await query(
      `UPDATE "WorkRequest" SET
        title = $1,
        description = $2,
        priority = $3,
        status = $4,
        "projectId" = $5,
        "serviceId" = $6,
        "teamId" = $7,
        "dueDate" = $8,
        "assigneeId" = $9,
        "assigneeTeamId" = $10,
        "actionId" = $11,
        "updatedAt" = $12
       WHERE id = $13`,
      [
        title,
        description,
        priority,
        status,
        projectId,
        serviceId,
        teamId,
        dueDate ? new Date(dueDate) : null,
        assigneeId,
        assigneeTeamId,
        actionId,
        new Date(),
        id,
      ],
    );

    const workRequest = await buildBasicWorkRequest(id);

    res.json(workRequest);
  } catch (error) {
    errorLogger.error('Update work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a work request (only requester can delete)
export const deleteWorkRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workRequest = await queryOne<any>(
      `SELECT id, "requesterId" FROM "WorkRequest" WHERE id = $1`,
      [id],
    );

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    // Only requester can delete
    if (workRequest.requesterId !== userId) {
      return res.status(403).json({ error: 'Only requester can delete work request' });
    }

    await query(`DELETE FROM "WorkRequest" WHERE id = $1`, [id]);

    res.json({ message: 'Work request deleted successfully' });
  } catch (error) {
    errorLogger.error('Delete work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Recall a work request (only requester can recall)
export const recallWorkRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workRequest = await queryOne<any>(
      `SELECT id, "requesterId" FROM "WorkRequest" WHERE id = $1`,
      [id],
    );

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    // Only requester can recall
    if (workRequest.requesterId !== userId) {
      return res.status(403).json({ error: 'Only requester can recall work request' });
    }

    // Update to recalled status
    await query(
      `UPDATE "WorkRequest" SET "isRecalled" = true, "isApproved" = false, "updatedAt" = $1 WHERE id = $2`,
      [new Date(), id],
    );

    const updatedWorkRequest = await buildStateTransitionWorkRequest(id);

    res.json(updatedWorkRequest);
  } catch (error) {
    errorLogger.error('Recall work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Resubmit work request (from REJECTED or IN_NEGOTIATION status)
export const resubmitWorkRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workRequest = await queryOne<any>(
      `SELECT id, "requesterId", status, "assigneeId", "assigneeTeamId" FROM "WorkRequest" WHERE id = $1`,
      [id],
    );

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    // Only requester can resubmit
    if (workRequest.requesterId !== userId) {
      return res.status(403).json({ error: 'Only requester can resubmit work request' });
    }

    // Can only resubmit if REJECTED or IN_NEGOTIATION
    if (
      workRequest.status !== WorkRequestStatus.REJECTED &&
      workRequest.status !== WorkRequestStatus.IN_NEGOTIATION
    ) {
      return res.status(400).json({ error: 'Can only resubmit rejected or negotiating work requests' });
    }

    // Reset to PENDING status and clear rejection/negotiation fields
    await query(
      `UPDATE "WorkRequest" SET
        status = $1,
        "rejectedAt" = NULL,
        "rejectedById" = NULL,
        "rejectionMessage" = NULL,
        "negotiationMessage" = NULL,
        "negotiationAt" = NULL,
        "negotiationById" = NULL,
        "updatedAt" = $2
       WHERE id = $3`,
      [WorkRequestStatus.PENDING, new Date(), id],
    );

    const updatedWorkRequest = await buildStateTransitionWorkRequest(id);

    // 알림 전송
    NotificationService.notifyWorkRequestResubmitted({
      workRequestId: updatedWorkRequest.id,
      title: updatedWorkRequest.title,
      requesterId: userId,
      assigneeId: workRequest.assigneeId || undefined,
      assigneeTeamId: workRequest.assigneeTeamId || undefined,
    }).catch(err => errorLogger.error('Failed to send notification:', { error: err }));

    res.json(updatedWorkRequest);
  } catch (error) {
    errorLogger.error('Resubmit work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Approve a work request (assignee or team member can approve)
export const approveWorkRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workRequest = await fetchWorkRequestWithAssigneeTeam(id);

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    if (!isAssigneeOrTeamMember(workRequest, userId)) {
      return res.status(403).json({ error: 'Only assignee or team member can approve work request' });
    }

    // Cannot approve if recalled
    if (workRequest.isRecalled) {
      return res.status(400).json({ error: 'Cannot approve recalled work request' });
    }

    // Update to approved status
    await query(
      `UPDATE "WorkRequest" SET
        "isApproved" = true,
        "approvedAt" = $1,
        "approvedById" = $2,
        "updatedAt" = $3
       WHERE id = $4`,
      [new Date(), userId, new Date(), id],
    );

    const updatedWorkRequest = await buildStateTransitionWorkRequest(id);

    // 알림 전송
    NotificationService.notifyWorkRequestApproved({
      workRequestId: updatedWorkRequest.id,
      title: updatedWorkRequest.title,
      requesterId: updatedWorkRequest.requesterId,
      approvedById: userId,
    }).catch(err => errorLogger.error('Failed to send notification:', { error: err }));

    res.json(updatedWorkRequest);
  } catch (error) {
    errorLogger.error('Approve work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Unapprove work request (only approver can unapprove)
export const unapproveWorkRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workRequest = await queryOne<any>(
      `SELECT id, "requesterId", "approvedById", "actionId", "isApproved", title FROM "WorkRequest" WHERE id = $1`,
      [id],
    );

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    // Only the approver can unapprove
    if (workRequest.approvedById !== userId) {
      return res.status(403).json({ error: 'Only the approver can cancel approval' });
    }

    // Cannot unapprove if action already created
    if (workRequest.actionId) {
      return res.status(400).json({ error: 'Cannot cancel approval after action has been created' });
    }

    // Cannot unapprove if not approved
    if (!workRequest.isApproved) {
      return res.status(400).json({ error: 'Work request is not approved' });
    }

    // Update to unapproved status
    await query(
      `UPDATE "WorkRequest" SET
        "isApproved" = false,
        "approvedAt" = NULL,
        "approvedById" = NULL,
        "updatedAt" = $1
       WHERE id = $2`,
      [new Date(), id],
    );

    const updatedWorkRequest = await buildStateTransitionWorkRequest(id);

    // Create notification for requester
    await query(
      `INSERT INTO "Notification" (id, type, content, "fromUserId", "toUserId", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        'work_request_unapproved',
        `작업 요청 "${workRequest.title}"의 승인이 취소되었습니다.`,
        userId,
        workRequest.requesterId,
        new Date(),
      ],
    );

    res.json(updatedWorkRequest);
  } catch (error) {
    errorLogger.error('Unapprove work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create action from work request (only assignee can create after approval)
export const createActionFromWorkRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workRequest = await queryOne<any>(
      `SELECT * FROM "WorkRequest" WHERE id = $1`,
      [id],
    );

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    // Only assignee can create action
    if (workRequest.assigneeId !== userId) {
      return res.status(403).json({ error: 'Only assignee can create action' });
    }

    // Must be approved first
    if (!workRequest.isApproved) {
      return res.status(400).json({ error: 'Work request must be approved first' });
    }

    // Already has action
    if (workRequest.actionId) {
      return res.status(400).json({ error: 'Action already exists for this work request' });
    }

    // Validate hierarchy before creating action
    if (!workRequest.projectId) {
      return res.status(400).json({
        error: 'Project is required to create action',
        needsHierarchy: true
      });
    }

    if (!workRequest.serviceId) {
      return res.status(400).json({
        error: 'Service is required to create action. Please select or create a service first.',
        needsHierarchy: true,
        missingLevel: 'SERVICE'
      });
    }

    if (!workRequest.teamId) {
      return res.status(400).json({
        error: 'Team is required to create action. Please select or create a team first.',
        needsHierarchy: true,
        missingLevel: 'TEAM'
      });
    }

    const actionId = randomUUID();
    const now = new Date();

    // Create action
    await query(
      `INSERT INTO "Item" (id, type, name, description, "parentId", "assigneeId", "createdById", "startDate", "endDate", "updatedAt", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        actionId,
        'ACTION',
        workRequest.title,
        workRequest.description,
        workRequest.teamId,
        workRequest.assigneeId,
        userId,
        now,
        workRequest.dueDate || null,
        now,
        now,
      ],
    );

    // Link action to work request
    await query(
      `UPDATE "WorkRequest" SET "actionId" = $1, "updatedAt" = $2 WHERE id = $3`,
      [actionId, now, id],
    );

    const updatedWorkRequest = await buildWorkRequestWithAction(id);

    res.json(updatedWorkRequest);
  } catch (error) {
    errorLogger.error('Create action from work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get team work requests (requests where teamId matches user's teams)
export const getTeamWorkRequests = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user with team info
    const user = await queryOne<any>(
      `SELECT "teamId" FROM "User" WHERE id = $1`,
      [userId],
    );

    if (!user || !user.teamId) {
      // User has no team, return empty array
      return res.json([]);
    }

    const workRequests = await query<any>(
      `SELECT wr.*,
              row_to_json(req.*) AS "Requester",
              row_to_json(asgn.*) AS "Assignee",
              CASE WHEN at.id IS NOT NULL THEN json_build_object('id', at.id, 'name', at.name, 'description', at.description) ELSE NULL END AS "AssigneeTeam",
              row_to_json(appr.*) AS "ApprovedBy",
              row_to_json(act.*) AS "Action",
              CASE WHEN proj.id IS NOT NULL THEN json_build_object('id', proj.id, 'name', proj.name) ELSE NULL END AS "Project",
              CASE WHEN svc.id IS NOT NULL THEN json_build_object('id', svc.id, 'name', svc.name) ELSE NULL END AS "Service",
              CASE WHEN tm.id IS NOT NULL THEN json_build_object('id', tm.id, 'name', tm.name) ELSE NULL END AS "Team"
       FROM "WorkRequest" wr
       LEFT JOIN (SELECT ${USER_COLS} FROM "User") req ON req.id = wr."requesterId"
       LEFT JOIN (SELECT ${USER_COLS} FROM "User") asgn ON asgn.id = wr."assigneeId"
       LEFT JOIN "Team" at ON at.id = wr."assigneeTeamId"
       LEFT JOIN (SELECT ${USER_COLS} FROM "User") appr ON appr.id = wr."approvedById"
       LEFT JOIN "Item" act ON act.id = wr."actionId"
       LEFT JOIN "Item" proj ON proj.id = wr."projectId"
       LEFT JOIN "Item" svc ON svc.id = wr."serviceId"
       LEFT JOIN "Item" tm ON tm.id = wr."teamId"
       WHERE wr."assigneeTeamId" = $1 OR wr."teamId" = $1
       ORDER BY wr.status ASC, wr.priority DESC, wr."createdAt" DESC`,
      [user.teamId],
    );

    res.json(workRequests);
  } catch (error) {
    errorLogger.error('Get team work requests error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Assign individual assignee to team-assigned work request
export const assignToIndividual = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { assigneeId } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!assigneeId) {
      return res.status(400).json({ error: 'Assignee ID is required' });
    }

    // Get work request with assignee team members
    const workRequest = await queryOne<any>(
      `SELECT wr.*, at.id AS "at_id", at.name AS "at_name", at.description AS "at_desc"
       FROM "WorkRequest" wr
       LEFT JOIN "Team" at ON at.id = wr."assigneeTeamId"
       WHERE wr.id = $1`,
      [id],
    );

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    // Check if work request has team assignment and no individual assignment
    if (!workRequest.assigneeTeamId || workRequest.assigneeId) {
      return res.status(400).json({
        error: 'Can only assign individual to team-assigned work requests without existing assignee'
      });
    }

    // Fetch team members for permission check
    const teamMembers = await query<any>(
      `SELECT id, role FROM "User" WHERE "teamId" = $1`,
      [workRequest.assigneeTeamId],
    );

    // Check permission: ADMIN, or PM/PO in the assigned team
    let hasPermission = false;

    if (userRole === 'ADMIN') {
      hasPermission = true;
    } else {
      const userInTeam = teamMembers.find((u: any) => u.id === userId);
      if (userInTeam && (userInTeam.role === 'PM' || userInTeam.role === 'PO')) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Only ADMIN or team PM/PO can assign work to individual members'
      });
    }

    // Verify assignee is in the team
    const assigneeInTeam = teamMembers.some((u: any) => u.id === assigneeId);
    if (!assigneeInTeam) {
      return res.status(400).json({
        error: 'Assignee must be a member of the assigned team'
      });
    }

    // Update work request with individual assignee
    await query(
      `UPDATE "WorkRequest" SET "assigneeId" = $1, "updatedAt" = $2 WHERE id = $3`,
      [assigneeId, new Date(), id],
    );

    const updatedWorkRequest = await buildFullWorkRequest(id);

    // 알림 전송
    NotificationService.notifyWorkRequestAssigned({
      workRequestId: updatedWorkRequest.id,
      title: updatedWorkRequest.title,
      assigneeId,
      assignedById: userId,
    }).catch(err => errorLogger.error('Failed to send notification:', { error: err }));

    res.json(updatedWorkRequest);
  } catch (error) {
    errorLogger.error('Assign to individual error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reject work request
export const rejectWorkRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectionMessage } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workRequest = await fetchWorkRequestWithAssigneeTeam(id);

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    if (!isAssigneeOrTeamMember(workRequest, userId)) {
      return res.status(403).json({ error: 'Only assignee or team member can reject work request' });
    }

    // Cannot reject if already approved or recalled
    if (workRequest.isApproved) {
      return res.status(400).json({ error: 'Cannot reject approved work request' });
    }
    if (workRequest.isRecalled) {
      return res.status(400).json({ error: 'Cannot reject recalled work request' });
    }

    await query(
      `UPDATE "WorkRequest" SET
        status = $1,
        "rejectedAt" = $2,
        "rejectedById" = $3,
        "rejectionMessage" = $4,
        "updatedAt" = $5
       WHERE id = $6`,
      ['REJECTED', new Date(), userId, rejectionMessage, new Date(), id],
    );

    const updatedWorkRequest = await buildStateTransitionWorkRequest(id);

    // 알림 전송
    NotificationService.notifyWorkRequestRejected({
      workRequestId: updatedWorkRequest.id,
      title: updatedWorkRequest.title,
      requesterId: updatedWorkRequest.requesterId,
      rejectedById: userId,
      rejectionMessage,
    }).catch(err => errorLogger.error('Failed to send notification:', { error: err }));

    res.json(updatedWorkRequest);
  } catch (error) {
    errorLogger.error('Reject work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Request negotiation
export const requestNegotiation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { negotiationMessage } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!negotiationMessage) {
      return res.status(400).json({ error: 'Negotiation message is required' });
    }

    const workRequest = await fetchWorkRequestWithAssigneeTeam(id);

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    if (!isAssigneeOrTeamMember(workRequest, userId)) {
      return res.status(403).json({ error: 'Only assignee or team member can request negotiation' });
    }

    // Cannot negotiate if already approved or recalled
    if (workRequest.isApproved) {
      return res.status(400).json({ error: 'Cannot negotiate approved work request' });
    }
    if (workRequest.isRecalled) {
      return res.status(400).json({ error: 'Cannot negotiate recalled work request' });
    }

    await query(
      `UPDATE "WorkRequest" SET
        status = $1,
        "negotiationMessage" = $2,
        "negotiationAt" = $3,
        "negotiationById" = $4,
        "updatedAt" = $5
       WHERE id = $6`,
      ['IN_NEGOTIATION', negotiationMessage, new Date(), userId, new Date(), id],
    );

    const updatedWorkRequest = await buildStateTransitionWorkRequest(id);

    // 알림 전송
    NotificationService.notifyWorkRequestNegotiation({
      workRequestId: updatedWorkRequest.id,
      title: updatedWorkRequest.title,
      requesterId: updatedWorkRequest.requesterId,
      negotiatedById: userId,
      negotiationMessage,
    }).catch(err => errorLogger.error('Failed to send notification:', { error: err }));

    res.json(updatedWorkRequest);
  } catch (error) {
    errorLogger.error('Request negotiation error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Validate if work request can create action
 * Check hierarchy requirements (project, service, team)
 */
export const validateActionCreation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = await validateHierarchyForAction(id);
    if (!validation) {
      return res.status(404).json({ error: 'Work request not found' });
    }
    res.json(validation);
  } catch (error) {
    errorLogger.error('Validate action creation error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create hierarchy creation request (SERVICE or TEAM)
 */
export const createHierarchyRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      parentWorkRequestId,
      requestType,
      targetItemType,
      projectId,
      serviceId,
      assigneeId,
      title,
      description,
      priority,
    } = req.body;

    if (!parentWorkRequestId || !requestType || !targetItemType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newId = randomUUID();
    const now = new Date();

    await query(
      `INSERT INTO "WorkRequest" (
        id, title, description, priority, status, "requestType", "parentWorkRequestId",
        "targetItemType", "projectId", "serviceId", "requesterId", "assigneeId",
        "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        newId,
        title || `[자동] ${targetItemType} 생성 필요`,
        description || `상위 작업 요청을 위해 ${targetItemType} 생성이 필요합니다.`,
        priority || 'HIGH',
        'PENDING',
        requestType as WorkRequestType,
        parentWorkRequestId,
        targetItemType as ItemType,
        projectId,
        serviceId,
        userId,
        assigneeId,
        now,
        now,
      ],
    );

    // Fetch created work request with relations
    const workRequest = await queryOne<any>(
      `SELECT wr.*,
              row_to_json(req.*) AS "Requester",
              row_to_json(asgn.*) AS "Assignee",
              row_to_json(pwr.*) AS "ParentWorkRequest"
       FROM "WorkRequest" wr
       LEFT JOIN (SELECT ${USER_COLS} FROM "User") req ON req.id = wr."requesterId"
       LEFT JOIN (SELECT ${USER_COLS} FROM "User") asgn ON asgn.id = wr."assigneeId"
       LEFT JOIN "WorkRequest" pwr ON pwr.id = wr."parentWorkRequestId"
       WHERE wr.id = $1`,
      [newId],
    );

    // Send notification to assignee
    if (assigneeId) {
      let projectName: string | undefined;
      let serviceName: string | undefined;

      if (projectId) {
        const project = await queryOne<any>(
          `SELECT name FROM "Item" WHERE id = $1`,
          [projectId],
        );
        projectName = project?.name;
      }

      if (serviceId) {
        const service = await queryOne<any>(
          `SELECT name FROM "Item" WHERE id = $1`,
          [serviceId],
        );
        serviceName = service?.name;
      }

      NotificationService.notifyHierarchyRequest({
        workRequestId: workRequest.id,
        requestType,
        targetItemType,
        requesterId: userId,
        assigneeId,
        parentWorkRequestId,
        projectName,
        serviceName,
      }).catch(err => errorLogger.error('Failed to send hierarchy request notification:', { error: err }));
    }

    res.status(201).json(workRequest);
  } catch (error) {
    errorLogger.error('Create hierarchy request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Link created item (service/team) to work request
 */
export const linkCreatedHierarchy = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { createdItemId } = req.body;

    const workRequest = await queryOne<any>(
      `SELECT * FROM "WorkRequest" WHERE id = $1`,
      [id],
    );

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    await query(
      `UPDATE "WorkRequest" SET "createdItemId" = $1, "updatedAt" = $2 WHERE id = $3`,
      [createdItemId, new Date(), id],
    );

    const updated = await queryOne<any>(
      `SELECT * FROM "WorkRequest" WHERE id = $1`,
      [id],
    );

    // Update parent work request with created hierarchy
    if (workRequest.parentWorkRequestId) {
      const updateFields: string[] = [`"updatedAt" = $1`];
      const updateParams: any[] = [new Date()];
      let paramIdx = 2;

      if (workRequest.requestType === 'SERVICE_CREATE') {
        updateFields.push(`"serviceId" = $${paramIdx++}`);
        updateParams.push(createdItemId);
      } else if (workRequest.requestType === 'TEAM_CREATE') {
        updateFields.push(`"teamId" = $${paramIdx++}`);
        updateParams.push(createdItemId);
      }

      updateParams.push(workRequest.parentWorkRequestId);
      await query(
        `UPDATE "WorkRequest" SET ${updateFields.join(', ')} WHERE id = $${paramIdx}`,
        updateParams,
      );

      // Notify original requester that hierarchy was created
      const parentRequest = await queryOne<any>(
        `SELECT "requesterId", "assigneeId" FROM "WorkRequest" WHERE id = $1`,
        [workRequest.parentWorkRequestId],
      );

      const createdItem = await queryOne<any>(
        `SELECT name FROM "Item" WHERE id = $1`,
        [createdItemId],
      );

      if (parentRequest && createdItem) {
        const notifyUserId = parentRequest.assigneeId || parentRequest.requesterId;
        const creatorId = req.user?.id || workRequest.requesterId;

        if (notifyUserId && creatorId) {
          const itemType = workRequest.requestType === 'SERVICE_CREATE' ? 'SERVICE' : 'TEAM';

          NotificationService.notifyHierarchyCreated({
            itemType,
            itemName: createdItem.name,
            originalRequesterId: notifyUserId,
            originalWorkRequestId: workRequest.parentWorkRequestId,
            createdById: creatorId,
          }).catch(err => errorLogger.error('Failed to send hierarchy created notification:', { error: err }));
        }
      }
    }

    res.json(updated);
  } catch (error) {
    errorLogger.error('Link created hierarchy error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all work requests (Admin only)
export const getAllWorkRequests = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can view all work requests' });
    }

    const workRequests = await query<any>(
      `SELECT wr.*,
              row_to_json(req.*) AS "Requester",
              row_to_json(asgn.*) AS "Assignee",
              CASE WHEN at.id IS NOT NULL THEN json_build_object('id', at.id, 'name', at.name, 'description', at.description) ELSE NULL END AS "AssigneeTeam",
              row_to_json(appr.*) AS "ApprovedBy",
              row_to_json(act.*) AS "Action",
              CASE WHEN proj.id IS NOT NULL THEN json_build_object('id', proj.id, 'name', proj.name) ELSE NULL END AS "Project",
              CASE WHEN svc.id IS NOT NULL THEN json_build_object('id', svc.id, 'name', svc.name) ELSE NULL END AS "Service",
              CASE WHEN tm.id IS NOT NULL THEN json_build_object('id', tm.id, 'name', tm.name) ELSE NULL END AS "Team"
       FROM "WorkRequest" wr
       LEFT JOIN (SELECT ${USER_COLS} FROM "User") req ON req.id = wr."requesterId"
       LEFT JOIN (SELECT ${USER_COLS} FROM "User") asgn ON asgn.id = wr."assigneeId"
       LEFT JOIN "Team" at ON at.id = wr."assigneeTeamId"
       LEFT JOIN (SELECT ${USER_COLS} FROM "User") appr ON appr.id = wr."approvedById"
       LEFT JOIN "Item" act ON act.id = wr."actionId"
       LEFT JOIN "Item" proj ON proj.id = wr."projectId"
       LEFT JOIN "Item" svc ON svc.id = wr."serviceId"
       LEFT JOIN "Item" tm ON tm.id = wr."teamId"
       ORDER BY wr."createdAt" DESC`,
    );

    res.json(workRequests);
  } catch (error) {
    errorLogger.error('Get all work requests error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Cancel work request (assignee can cancel IN_NEGOTIATION requests)
export const cancelWorkRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workRequest = await fetchWorkRequestWithAssigneeTeam(id);

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    if (!isAssigneeOrTeamMember(workRequest, userId)) {
      return res.status(403).json({ error: 'Only assignee or team member can cancel work request' });
    }

    // Can only cancel if IN_NEGOTIATION or REJECTED status
    if (
      workRequest.status !== WorkRequestStatus.IN_NEGOTIATION &&
      workRequest.status !== WorkRequestStatus.REJECTED
    ) {
      return res.status(400).json({ error: 'Can only cancel work requests in negotiation or rejected status' });
    }

    // Cannot cancel if already approved or has action
    if (workRequest.isApproved) {
      return res.status(400).json({ error: 'Cannot cancel approved work request' });
    }
    if (workRequest.actionId) {
      return res.status(400).json({ error: 'Cannot cancel work request with action' });
    }

    await query(
      `UPDATE "WorkRequest" SET status = $1, "updatedAt" = $2 WHERE id = $3`,
      ['CANCELLED', new Date(), id],
    );

    const updatedWorkRequest = await buildStateTransitionWorkRequest(id);

    // 알림 전송
    await query(
      `INSERT INTO "Notification" (id, type, content, "fromUserId", "toUserId", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        'work_request_cancelled',
        `작업 요청 "${workRequest.title}"이(가) 취소되었습니다.`,
        userId,
        workRequest.requesterId,
        new Date(),
      ],
    );

    res.json(updatedWorkRequest);
  } catch (error) {
    errorLogger.error('Cancel work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin force delete work request
export const adminDeleteWorkRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can force delete work requests' });
    }

    const workRequest = await queryOne<any>(
      `SELECT id, "actionId" FROM "WorkRequest" WHERE id = $1`,
      [id],
    );

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    // Cannot delete if action exists
    if (workRequest.actionId) {
      return res.status(400).json({ error: 'Cannot delete work request with existing action' });
    }

    await query(`DELETE FROM "WorkRequest" WHERE id = $1`, [id]);

    res.json({ message: 'Work request deleted successfully by admin' });
  } catch (error) {
    errorLogger.error('Admin delete work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Forward work request to another user
export const forwardWorkRequest = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { newAssigneeId } = req.body;
    const userId = req.user?.id;

    if (!newAssigneeId) {
      return res.status(400).json({ error: '전달받을 사용자를 선택해주세요' });
    }

    // Get work request
    const workRequest = await queryOne<any>(
      `SELECT * FROM "WorkRequest" WHERE id = $1`,
      [id],
    );

    if (!workRequest) {
      return res.status(404).json({ error: '작업 요청을 찾을 수 없습니다' });
    }

    // Check if user is the current assignee
    if (workRequest.assigneeId !== userId) {
      return res.status(403).json({ error: '현재 담당자만 작업 요청을 전달할 수 있습니다' });
    }

    // Check if already approved
    if (workRequest.isApproved) {
      return res.status(400).json({ error: '이미 승인된 작업 요청은 전달할 수 없습니다' });
    }

    // Check if recalled
    if (workRequest.isRecalled) {
      return res.status(400).json({ error: '회수된 작업 요청은 전달할 수 없습니다' });
    }

    // Get new assignee info
    const newAssignee = await queryOne<any>(
      `SELECT id, "teamId", "displayName" FROM "User" WHERE id = $1`,
      [newAssigneeId],
    );

    if (!newAssignee) {
      return res.status(404).json({ error: '전달받을 사용자를 찾을 수 없습니다' });
    }

    // Update work request
    await query(
      `UPDATE "WorkRequest" SET "assigneeId" = $1, "assigneeTeamId" = $2, "updatedAt" = $3 WHERE id = $4`,
      [newAssigneeId, newAssignee.teamId, new Date(), id],
    );

    const updated = await buildFullWorkRequest(id);

    // Create notification for new assignee
    await NotificationService.createNotification({
      type: 'work_request_forwarded',
      content: `${req.user?.displayName}님이 작업 요청 "${workRequest.title}"을(를) 전달했습니다`,
      fromUserId: userId!,
      toUserId: newAssigneeId,
    });

    // Create notification for original requester
    await NotificationService.createNotification({
      type: 'work_request_forwarded',
      content: `작업 요청 "${workRequest.title}"이(가) ${newAssignee.displayName}님께 전달되었습니다`,
      fromUserId: userId!,
      toUserId: workRequest.requesterId,
    });

    res.json(updated);
  } catch (error) {
    errorLogger.error('Forward work request error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
