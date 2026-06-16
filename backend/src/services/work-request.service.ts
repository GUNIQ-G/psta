import prisma from '../config/database';
import { USER_SELECT } from '../utils/prisma-selects';

// Shared include for fetching AssigneeTeam members (used in permission checks)
export const ASSIGNEE_TEAM_CHECK_INCLUDE = {
  AssigneeTeam: {
    include: {
      User: {
        select: { id: true },
      },
    },
  },
} as const;

// Shared include for state transition responses (approve, reject, recall, resubmit, cancel, negotiate, unapprove)
export const STATE_TRANSITION_INCLUDE = {
  Requester: { select: USER_SELECT },
  Assignee: { select: USER_SELECT },
  AssigneeTeam: { select: { id: true, name: true, description: true } },
  ApprovedBy: { select: USER_SELECT },
} as const;

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
  const workRequest = await prisma.workRequest.findUnique({
    where: { id: workRequestId },
    include: {
      Project: true,
      Service: true,
      Team: true,
    },
  });

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
    const services = await prisma.item.findMany({
      where: { parentId: workRequest.projectId, type: 'SERVICE' },
    });
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
    const teams = await prisma.item.findMany({
      where: { parentId: workRequest.serviceId, type: 'TEAM' },
    });
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
