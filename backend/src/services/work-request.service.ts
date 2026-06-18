import { query, queryOne } from '../config/database';

const USER_COLS = `id, username, "displayName", email`;

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch a work request with its AssigneeTeam and team members (for permission checks).
 * Mirrors the old ASSIGNEE_TEAM_CHECK_INCLUDE pattern.
 */
export const fetchWorkRequestWithAssigneeTeam = async (id: string): Promise<any | null> => {
  const wr = await queryOne<any>(
    `SELECT * FROM "WorkRequest" WHERE id = $1`,
    [id],
  );
  if (!wr) return null;

  if (wr.assigneeTeamId) {
    const teamMembers = await query<any>(
      `SELECT id FROM "User" WHERE "teamId" = $1`,
      [wr.assigneeTeamId],
    );
    wr.AssigneeTeam = { User: teamMembers };
  } else {
    wr.AssigneeTeam = null;
  }

  return wr;
};

/**
 * Fetch a work request with Requester, Assignee, AssigneeTeam, ApprovedBy
 * (for state transition responses — mirrors STATE_TRANSITION_INCLUDE).
 */
export const fetchWorkRequestWithStateTransition = async (id: string): Promise<any | null> => {
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
};

/**
 * Fetch a full work request with all related entities.
 */
export const fetchWorkRequestFull = async (id: string): Promise<any | null> => {
  return queryOne<any>(
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
};

// ─── Shared include constants (kept for compatibility, no longer Prisma objects) ──

// Check if user is the assignee or a member of the assignee team
export const isAssigneeOrTeamMember = (
  workRequest: {
    assigneeId: string | null;
    assigneeTeamId: string | null;
    AssigneeTeam?: { User: { id: string }[] } | null;
  },
  userId: string,
): boolean => {
  if (workRequest.assigneeId === userId) return true;
  if (workRequest.assigneeTeamId && workRequest.AssigneeTeam) {
    return workRequest.AssigneeTeam.User.some((u) => u.id === userId);
  }
  return false;
};

// Validate whether a work request has the required hierarchy (project, service, team) to create an action
export const validateHierarchyForAction = async (workRequestId: string) => {
  const workRequest = await queryOne<any>(
    `SELECT wr.*,
            row_to_json(proj.*) AS "Project",
            row_to_json(svc.*) AS "Service",
            row_to_json(tm.*) AS "Team"
     FROM "WorkRequest" wr
     LEFT JOIN "Item" proj ON proj.id = wr."projectId"
     LEFT JOIN "Item" svc ON svc.id = wr."serviceId"
     LEFT JOIN "Item" tm ON tm.id = wr."teamId"
     WHERE wr.id = $1`,
    [workRequestId],
  );

  if (!workRequest) return null;

  const validation: {
    canCreateAction: boolean;
    missingHierarchy: string[];
    suggestions: Array<{
      level: string;
      action: string;
      message?: string;
      existingItems?: any[];
    }>;
  } = {
    canCreateAction: true,
    missingHierarchy: [],
    suggestions: [],
  };

  if (!workRequest.projectId) {
    validation.canCreateAction = false;
    validation.missingHierarchy.push('PROJECT');
    validation.suggestions.push({
      level: 'PROJECT',
      action: 'SELECT_EXISTING',
      message: '프로젝트를 선택해주세요',
    });
  }

  if (workRequest.projectId && !workRequest.serviceId) {
    const services = await query<any>(
      `SELECT * FROM "Item" WHERE "parentId" = $1 AND type = 'SERVICE'`,
      [workRequest.projectId],
    );
    validation.canCreateAction = false;
    validation.missingHierarchy.push('SERVICE');
    if (services.length > 0) {
      validation.suggestions.push({
        level: 'SERVICE',
        action: 'SELECT_EXISTING',
        message: '기존 서비스 중에서 선택할 수 있습니다',
        existingItems: services,
      });
    } else {
      validation.suggestions.push({
        level: 'SERVICE',
        action: 'REQUEST_CREATION',
        message: '서비스가 없습니다. 생성을 요청하세요',
      });
    }
  }

  if (workRequest.serviceId && !workRequest.teamId) {
    const teams = await query<any>(
      `SELECT * FROM "Item" WHERE "parentId" = $1 AND type = 'TEAM'`,
      [workRequest.serviceId],
    );
    validation.canCreateAction = false;
    validation.missingHierarchy.push('TEAM');
    if (teams.length > 0) {
      validation.suggestions.push({
        level: 'TEAM',
        action: 'SELECT_EXISTING',
        message: '기존 팀 중에서 선택할 수 있습니다',
        existingItems: teams,
      });
    } else {
      validation.suggestions.push({
        level: 'TEAM',
        action: 'REQUEST_CREATION',
        message: '팀이 없습니다. 생성을 요청하세요',
      });
    }
  }

  return validation;
};
