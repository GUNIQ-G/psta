import { Response } from 'express';
import { WorkRequestStatus, WorkRequestType, ItemType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth';
import { NotificationService } from '../services/notification.service';
import prisma from '../config/database';
import appLogger, { errorLogger } from '../config/logger';
import { USER_SELECT, CREATOR_SELECT } from '../utils/prisma-selects';
import {
  ASSIGNEE_TEAM_CHECK_INCLUDE,
  STATE_TRANSITION_INCLUDE,
  isAssigneeOrTeamMember,
  validateHierarchyForAction,
} from '../services/work-request.service';

// Get all work requests
export const getWorkRequests = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { status, priority, assigneeId, requesterId } = req.query;

    const where: any = { isDeleted: false };

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by priority
    if (priority) {
      where.priority = priority;
    }

    // Filter by assignee
    if (assigneeId) {
      where.assigneeId = assigneeId;
    }

    // Filter by requester
    if (requesterId) {
      where.requesterId = requesterId;
    }

    const workRequests = await prisma.workRequest.findMany({
      where,
      include: {
        Requester: {
          select: USER_SELECT,
        },
        Assignee: {
          select: USER_SELECT,
        },
        ApprovedBy: {
          select: USER_SELECT,
        },
        Action: true,
        Project: {
          select: {
            id: true,
            name: true,
          },
        },
        Service: {
          select: {
            id: true,
            name: true,
          },
        },
        Team: {
          select: {
            id: true,
            name: true,
          },
        },
        AssigneeTeam: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

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

    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
      include: {
        Requester: {
          select: USER_SELECT,
        },
        Assignee: {
          select: USER_SELECT,
        },
        ApprovedBy: {
          select: USER_SELECT,
        },
        Action: true,
        Project: {
          select: {
            id: true,
            name: true,
          },
        },
        Service: {
          select: {
            id: true,
            name: true,
          },
        },
        Team: {
          select: {
            id: true,
            name: true,
          },
        },
        AssigneeTeam: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

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

    const workRequest = await prisma.workRequest.create({
      data: {
        id: randomUUID(),
        title,
        description,
        priority: priority || 'MEDIUM',
        projectId: projectId || null,
        serviceId: serviceId || null,
        teamId: teamId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        requesterId: userId,
        assigneeId: assigneeId || null,
        assigneeTeamId: assigneeTeamId || null,
        updatedAt: new Date(),
      },
      include: {
        Requester: {
          select: USER_SELECT,
        },
        Assignee: {
          select: USER_SELECT,
        },
        AssigneeTeam: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

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

    const workRequest = await prisma.workRequest.update({
      where: { id },
      data: {
        title,
        description,
        priority,
        status,
        projectId,
        serviceId,
        teamId,
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeId,
        assigneeTeamId,
        actionId,
        updatedAt: new Date(),
      },
      include: {
        Requester: {
          select: USER_SELECT,
        },
        Assignee: {
          select: USER_SELECT,
        },
        AssigneeTeam: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

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

    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
    });

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    // Only requester can delete
    if (workRequest.requesterId !== userId) {
      return res.status(403).json({ error: 'Only requester can delete work request' });
    }

    await prisma.workRequest.delete({
      where: { id },
    });

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

    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
    });

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    // Only requester can recall
    if (workRequest.requesterId !== userId) {
      return res.status(403).json({ error: 'Only requester can recall work request' });
    }

    // Update to recalled status
    const updatedWorkRequest = await prisma.workRequest.update({
      where: { id },
      data: {
        isRecalled: true,
        isApproved: false,
        updatedAt: new Date(),
      },
      include: STATE_TRANSITION_INCLUDE,
    });

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

    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
    });

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
    const updatedWorkRequest = await prisma.workRequest.update({
      where: { id },
      data: {
        status: WorkRequestStatus.PENDING,
        rejectedAt: null,
        rejectedById: null,
        rejectionMessage: null,
        negotiationMessage: null,
        negotiationAt: null,
        negotiationById: null,
        updatedAt: new Date(),
      },
      include: STATE_TRANSITION_INCLUDE,
    });

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

    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
      include: ASSIGNEE_TEAM_CHECK_INCLUDE,
    });

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
    const updatedWorkRequest = await prisma.workRequest.update({
      where: { id },
      data: {
        isApproved: true,
        approvedAt: new Date(),
        approvedById: userId,
        updatedAt: new Date(),
      },
      include: STATE_TRANSITION_INCLUDE,
    });

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

    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
    });

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
    const updatedWorkRequest = await prisma.workRequest.update({
      where: { id },
      data: {
        isApproved: false,
        approvedAt: null,
        approvedById: null,
        updatedAt: new Date(),
      },
      include: STATE_TRANSITION_INCLUDE,
    });

    // Create notification for requester
    await prisma.notification.create({
      data: {
        id: randomUUID(),
        type: 'work_request_unapproved',
        content: `작업 요청 "${workRequest.title}"의 승인이 취소되었습니다.`,
        fromUserId: userId,
        toUserId: workRequest.requesterId,
        createdAt: new Date(),
      },
    });

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

    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
    });

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

    // Create action
    const action = await prisma.item.create({
      data: {
        id: randomUUID(),
        type: 'ACTION',
        name: workRequest.title,
        description: workRequest.description,
        parentId: workRequest.teamId,
        assigneeId: workRequest.assigneeId,
        createdById: userId,
        startDate: new Date(),
        endDate: workRequest.dueDate,
        updatedAt: new Date(),
      },
    });

    // Link action to work request
    const updatedWorkRequest = await prisma.workRequest.update({
      where: { id },
      data: {
        actionId: action.id,
        updatedAt: new Date(),
      },
      include: {
        Requester: {
          select: USER_SELECT,
        },
        Assignee: {
          select: USER_SELECT,
        },
        AssigneeTeam: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        ApprovedBy: {
          select: USER_SELECT,
        },
        Action: true,
      },
    });

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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true },
    });

    if (!user || !user.teamId) {
      // User has no team, return empty array
      return res.json([]);
    }

    // Get all work requests where assigneeTeamId or teamId matches user's team
    const workRequests = await prisma.workRequest.findMany({
      where: {
        OR: [
          { assigneeTeamId: user.teamId }, // Team assigned work requests
          { teamId: user.teamId },          // Work requests in team's project hierarchy
        ],
      },
      include: {
        Requester: {
          select: USER_SELECT,
        },
        Assignee: {
          select: USER_SELECT,
        },
        AssigneeTeam: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        ApprovedBy: {
          select: USER_SELECT,
        },
        Action: {
          include: {
            User_Item_assigneeIdToUser: {
              select: USER_SELECT,
            },
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
          },
        },
        Service: {
          select: {
            id: true,
            name: true,
          },
        },
        Team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

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

    // Get work request
    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
      include: {
        AssigneeTeam: {
          include: {
            User: {
              select: {
                id: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    // Check if work request has team assignment and no individual assignment
    if (!workRequest.assigneeTeamId || workRequest.assigneeId) {
      return res.status(400).json({
        error: 'Can only assign individual to team-assigned work requests without existing assignee'
      });
    }

    // Check permission: ADMIN, or PM/PO in the assigned team
    let hasPermission = false;

    if (userRole === 'ADMIN') {
      hasPermission = true;
    } else if (workRequest.AssigneeTeam) {
      const userInTeam = workRequest.AssigneeTeam.User.find((u) => u.id === userId);
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
    if (workRequest.AssigneeTeam) {
      const assigneeInTeam = workRequest.AssigneeTeam.User.some((u) => u.id === assigneeId);
      if (!assigneeInTeam) {
        return res.status(400).json({
          error: 'Assignee must be a member of the assigned team'
        });
      }
    }

    // Update work request with individual assignee
    const updatedWorkRequest = await prisma.workRequest.update({
      where: { id },
      data: {
        assigneeId,
        updatedAt: new Date(),
      },
      include: {
        Requester: {
          select: USER_SELECT,
        },
        Assignee: {
          select: USER_SELECT,
        },
        AssigneeTeam: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        ApprovedBy: {
          select: USER_SELECT,
        },
        Action: true,
        Project: {
          select: {
            id: true,
            name: true,
          },
        },
        Service: {
          select: {
            id: true,
            name: true,
          },
        },
        Team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

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

    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
      include: ASSIGNEE_TEAM_CHECK_INCLUDE,
    });

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

    const updatedWorkRequest = await prisma.workRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedById: userId,
        rejectionMessage,
        updatedAt: new Date(),
      },
      include: STATE_TRANSITION_INCLUDE,
    });

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

    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
      include: ASSIGNEE_TEAM_CHECK_INCLUDE,
    });

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

    const updatedWorkRequest = await prisma.workRequest.update({
      where: { id },
      data: {
        status: 'IN_NEGOTIATION',
        negotiationMessage,
        negotiationAt: new Date(),
        negotiationById: userId,
        updatedAt: new Date(),
      },
      include: STATE_TRANSITION_INCLUDE,
    });

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

    const workRequest = await prisma.workRequest.create({
      data: {
        id: randomUUID(),
        title: title || `[자동] ${targetItemType} 생성 필요`,
        description: description || `상위 작업 요청을 위해 ${targetItemType} 생성이 필요합니다.`,
        priority: priority || 'HIGH',
        status: 'PENDING',
        requestType: requestType as WorkRequestType,
        parentWorkRequestId,
        targetItemType: targetItemType as ItemType,
        projectId,
        serviceId,
        requesterId: userId,
        assigneeId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        Requester: {
          select: USER_SELECT,
        },
        Assignee: {
          select: USER_SELECT,
        },
        ParentWorkRequest: true,
      },
    });

    // Send notification to assignee
    if (assigneeId) {
      // Get project/service names for notification context
      let projectName: string | undefined;
      let serviceName: string | undefined;

      if (projectId) {
        const project = await prisma.item.findUnique({
          where: { id: projectId },
          select: { name: true },
        });
        projectName = project?.name;
      }

      if (serviceId) {
        const service = await prisma.item.findUnique({
          where: { id: serviceId },
          select: { name: true },
        });
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

    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
    });

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    const updated = await prisma.workRequest.update({
      where: { id },
      data: {
        createdItemId,
        updatedAt: new Date(),
      },
    });

    // Update parent work request with created hierarchy
    if (workRequest.parentWorkRequestId) {
      const updateData: any = { updatedAt: new Date() };

      if (workRequest.requestType === 'SERVICE_CREATE') {
        updateData.serviceId = createdItemId;
      } else if (workRequest.requestType === 'TEAM_CREATE') {
        updateData.teamId = createdItemId;
      }

      await prisma.workRequest.update({
        where: { id: workRequest.parentWorkRequestId },
        data: updateData,
      });

      // Notify original requester that hierarchy was created
      const parentRequest = await prisma.workRequest.findUnique({
        where: { id: workRequest.parentWorkRequestId },
        select: { requesterId: true, assigneeId: true },
      });

      const createdItem = await prisma.item.findUnique({
        where: { id: createdItemId },
        select: { name: true },
      });

      if (parentRequest && createdItem) {
        // Notify the assignee of the parent request (who triggered the hierarchy request)
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

    const workRequests = await prisma.workRequest.findMany({
      include: {
        Requester: {
          select: USER_SELECT,
        },
        Assignee: {
          select: USER_SELECT,
        },
        AssigneeTeam: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        ApprovedBy: {
          select: USER_SELECT,
        },
        Action: {
          include: {
            User_Item_assigneeIdToUser: {
              select: USER_SELECT,
            },
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
          },
        },
        Service: {
          select: {
            id: true,
            name: true,
          },
        },
        Team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
    });

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

    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
      include: ASSIGNEE_TEAM_CHECK_INCLUDE,
    });

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

    const updatedWorkRequest = await prisma.workRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
      include: STATE_TRANSITION_INCLUDE,
    });

    // 알림 전송
    await prisma.notification.create({
      data: {
        id: randomUUID(),
        type: 'work_request_cancelled',
        content: `작업 요청 "${workRequest.title}"이(가) 취소되었습니다.`,
        fromUserId: userId,
        toUserId: workRequest.requesterId,
        createdAt: new Date(),
      },
    });

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

    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
    });

    if (!workRequest) {
      return res.status(404).json({ error: 'Work request not found' });
    }

    // Cannot delete if action exists
    if (workRequest.actionId) {
      return res.status(400).json({ error: 'Cannot delete work request with existing action' });
    }

    await prisma.workRequest.delete({
      where: { id },
    });

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
    const workRequest = await prisma.workRequest.findUnique({
      where: { id },
      include: {
        Requester: true,
        Assignee: true,
      },
    });

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
    const newAssignee = await prisma.user.findUnique({
      where: { id: newAssigneeId },
    });

    if (!newAssignee) {
      return res.status(404).json({ error: '전달받을 사용자를 찾을 수 없습니다' });
    }

    // Update work request
    const updated = await prisma.workRequest.update({
      where: { id },
      data: {
        assigneeId: newAssigneeId,
        assigneeTeamId: newAssignee.teamId,
        updatedAt: new Date(),
      },
      include: {
        Requester: {
          select: USER_SELECT,
        },
        Assignee: {
          select: USER_SELECT,
        },
        AssigneeTeam: true,
        ApprovedBy: {
          select: USER_SELECT,
        },
        Action: true,
        Project: true,
        Service: true,
        Team: true,
      },
    });

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
