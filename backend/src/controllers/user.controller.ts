import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import userService from '../services/user.service';
import ldapService from '../config/ldap';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import appLogger, { errorLogger, ldapLogger } from '../config/logger';

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const includeRetired = req.query.includeRetired === 'true'; // v1.1.18: Filter out 퇴사자/휴직자
    const users = await userService.getAllUsers(includeInactive, includeRetired);
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { displayName, email, role, teamId, isVerified, isActive } = req.body;

    const user = await userService.updateUser(req.params.id, {
      displayName,
      email,
      role,
      teamId,
      isVerified,
      isActive,
    });

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const verifyUser = async (req: Request, res: Response) => {
  try {
    const { role, teamId } = req.body;

    const userRole = role || UserRole.MEMBER;
    const user = await userService.verifyUser(req.params.id, userRole, teamId);

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    await userService.deleteUser(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPendingUsers = async (req: Request, res: Response) => {
  try {
    const users = await userService.getPendingUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const assignToTeam = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const user = await userService.assignToTeam(req.params.id, teamId);
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const removeFromTeam = async (req: Request, res: Response) => {
  try {
    const user = await userService.removeFromTeam(req.params.id);
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTeamMembers = async (req: Request, res: Response) => {
  try {
    const users = await userService.getTeamMembers(req.params.teamId);
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPendingApprovals = async (req: Request, res: Response) => {
  try {
    const users = await userService.getPendingApprovals();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const approveUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.approveUser(req.params.id);
    appLogger.info(`[APPROVAL] User ${user.username} (${user.displayName}) has been approved`);
    res.json(user);
  } catch (error: any) {
    errorLogger.error('[APPROVAL] Approve user error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const rejectUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.rejectUser(req.params.id);
    appLogger.info(`[APPROVAL] User ${user.username} (${user.displayName}) approval request has been rejected`);
    res.json(user);
  } catch (error: any) {
    errorLogger.error('[APPROVAL] Reject user error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const syncUserFromLDAP = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.ldapDn) {
      return res.status(400).json({ error: 'User is not an LDAP user' });
    }

    ldapLogger.info(`[LDAP SYNC] Syncing user ${user.username} from LDAP...`);

    // Get user's LDAP groups
    let userGroups: string[] = [];
    try {
      userGroups = await ldapService.getUserGroups(user.ldapDn);
      ldapLogger.info(`[LDAP SYNC] User ${user.username} groups:`, { userGroups });
    } catch (groupErr: any) {
      errorLogger.error('[LDAP SYNC] Failed to get user groups:', { error: groupErr });
      return res.status(500).json({ error: `Failed to get LDAP groups: ${groupErr.message}` });
    }

    // Find the first matching team
    let teamId: string | null = null;
    if (userGroups.length > 0) {
      const team = await prisma.team.findFirst({
        where: {
          name: { in: userGroups },
          isActive: true,
        },
      });
      if (team) {
        teamId = team.id;
        ldapLogger.info(`[LDAP SYNC] User assigned to team: ${team.name}`);
      } else {
        ldapLogger.info(`[LDAP SYNC] No matching team found for groups:`, { userGroups });
      }
    }

    // Update user's team
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        teamId: teamId,
        updatedAt: new Date(),
      },
      include: {
        Team: true,
      },
    });

    ldapLogger.info(`[LDAP SYNC] User ${user.username} synced successfully. Team: ${updatedUser.Team?.name || 'none'}`);

    res.json({
      message: 'User synced from LDAP successfully',
      user: updatedUser,
    });
  } catch (error: any) {
    errorLogger.error('[LDAP SYNC] Sync user error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const syncAllUsersFromLDAP = async (req: Request, res: Response) => {
  try {
    ldapLogger.info('[LDAP SYNC ALL] Starting to sync all LDAP users...');

    const ldapUsers = await prisma.user.findMany({
      where: {
        ldapDn: { not: null },
      },
    });

    const results = {
      total: ldapUsers.length,
      synced: 0,
      errors: [] as string[],
    };

    for (const user of ldapUsers) {
      try {
        // Get user's LDAP groups
        const userGroups = await ldapService.getUserGroups(user.ldapDn!);

        // Find the first matching team
        let teamId: string | null = null;
        if (userGroups.length > 0) {
          const team = await prisma.team.findFirst({
            where: {
              name: { in: userGroups },
              isActive: true,
            },
          });
          if (team) {
            teamId = team.id;
          }
        }

        // Update user's team
        await prisma.user.update({
          where: { id: user.id },
          data: {
            teamId: teamId,
            updatedAt: new Date(),
          },
        });

        results.synced++;
        ldapLogger.info(`[LDAP SYNC ALL] Synced user ${user.username}`);
      } catch (error: any) {
        results.errors.push(`${user.username}: ${error.message}`);
        errorLogger.error(`[LDAP SYNC ALL] Failed to sync user ${user.username}:`, { error });
      }
    }

    ldapLogger.info(`[LDAP SYNC ALL] Completed. Synced: ${results.synced}/${results.total}`);

    res.json(results);
  } catch (error: any) {
    errorLogger.error('[LDAP SYNC ALL] Sync all users error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get user's managers for hierarchical workflow
 * Returns potential managers/team leaders who can approve hierarchy creation requests
 */
export const getUserManagers = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { context } = req.query; // 'service', 'team', 'project'

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        Team: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const managers: any[] = [];
    const managerIds = new Set<string>();

    // 1. User's team members with PO/PM roles
    if (user.Team) {
      const teamManagers = await prisma.user.findMany({
        where: {
          teamId: user.Team.id,
          role: { in: ['PO', 'PM'] },
          isActive: true,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          role: true,
        },
      });

      teamManagers.forEach(manager => {
        if (!managerIds.has(manager.id)) {
          managerIds.add(manager.id);
          managers.push({
            ...manager,
            priority: 1,
            reason: 'Team PO/PM',
          });
        }
      });
    }

    // 2. All PO users (high priority)
    const pos = await prisma.user.findMany({
      where: {
        role: 'PO',
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
      },
    });

    pos.forEach(po => {
      if (!managerIds.has(po.id)) {
        managerIds.add(po.id);
        managers.push({
          ...po,
          priority: 2,
          reason: 'Project Owner',
        });
      }
    });

    // 3. All PM users (medium priority)
    const pms = await prisma.user.findMany({
      where: {
        role: 'PM',
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
      },
    });

    pms.forEach(pm => {
      if (!managerIds.has(pm.id)) {
        managerIds.add(pm.id);
        managers.push({
          ...pm,
          priority: 3,
          reason: 'Project Manager',
        });
      }
    });

    // Sort by priority
    managers.sort((a, b) => a.priority - b.priority);

    res.json(managers);
  } catch (error: any) {
    errorLogger.error('Get user managers error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
