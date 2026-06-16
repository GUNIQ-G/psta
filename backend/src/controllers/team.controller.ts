import { Request, Response } from 'express';
import teamService from '../services/team.service';
import { LdapService } from '../config/ldap';
import { appLogger, errorLogger } from '../config/logger';
import prisma from '../config/database';

// Extend Request for authenticated user
interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export const getAllTeams = async (req: Request, res: Response) => {
  try {
    const teams = await teamService.getAllTeams();
    res.json(teams);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get team hierarchy
 * v1.1.18: Returns hierarchical team structure with users
 */
export const getTeamHierarchy = async (req: Request, res: Response) => {
  try {
    const hierarchy = await teamService.getTeamHierarchy();
    res.json(hierarchy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTeamById = async (req: Request, res: Response) => {
  try {
    const team = await teamService.getTeamById(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(team);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTeam = async (req: Request, res: Response) => {
  try {
    const { name, ldapDn, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const team = await teamService.createTeam({
      name,
      ldapDn,
      description,
    });

    res.status(201).json(team);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTeam = async (req: Request, res: Response) => {
  try {
    const { name, ldapDn, description, isActive } = req.body;

    const team = await teamService.updateTeam(req.params.id, {
      name,
      ldapDn,
      description,
      isActive,
    });

    res.json(team);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTeam = async (req: Request, res: Response) => {
  try {
    await teamService.deleteTeam(req.params.id);
    res.json({ message: 'Team deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const syncFromLDAP = async (req: Request, res: Response) => {
  try {
    const results = await teamService.syncFromLDAP();
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTeamMembers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const members = await teamService.getTeamMembers(id);
    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Reset all teams (organization initialization)
 * v1.1.19: Requires admin role and password verification
 * POST /api/teams/reset
 * Body: { password: string }
 */
export const resetTeams = async (req: AuthRequest, res: Response) => {
  try {
    // 1. Check admin permission
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: '관리자 권한이 필요합니다.',
      });
    }

    const { password } = req.body;
    const username = req.user.username;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: '비밀번호를 입력해주세요.',
      });
    }

    // 2. Verify password
    appLogger.info('Organization reset requested', {
      userId: req.user.id,
      username: req.user.username,
    });

    // Check if user has LDAP DN (is an LDAP user)
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { ldapDn: true }
    });

    const hasLdapDn = currentUser?.ldapDn && currentUser.ldapDn.length > 0;

    if (!hasLdapDn) {
      // Local admin without LDAP - skip password verification but log warning
      appLogger.warn('Organization reset - local admin without LDAP verification', {
        userId: req.user.id,
        username: req.user.username,
      });
      // Continue without password verification for local admin
      // This is acceptable because we already verified admin role
    } else {
      // LDAP user - verify via LDAP
      const ldapService = new LdapService();
      try {
        await ldapService.authenticate(username, password);
      } catch (authError: any) {
        errorLogger.error('Organization reset - LDAP password verification failed', {
          userId: req.user.id,
          username: req.user.username,
          error: authError.message,
        });
        return res.status(400).json({
          success: false,
          error: '비밀번호가 일치하지 않습니다.',
        });
      }
    }

    // 3. Execute reset
    appLogger.info('Organization reset - password verified, executing reset', {
      userId: req.user.id,
      username: req.user.username,
    });

    const result = await teamService.resetAllTeams();

    appLogger.info('Organization reset completed', {
      userId: req.user.id,
      username: req.user.username,
      deletedTeams: result.deletedTeams,
      updatedUsers: result.updatedUsers,
    });

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    errorLogger.error('Organization reset failed', {
      userId: req.user?.id,
      username: req.user?.username,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
