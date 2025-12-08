import { Request, Response } from 'express';
import ldapService from '../config/ldap';
import prisma from '../config/database';
import { generateToken, AuthRequest } from '../middleware/auth';
import { authLogger, errorLogger } from '../config/logger';

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check for local admin account first
    if (username === 'admin' && password === 'proadmin123$%') {
      let adminUser = await prisma.user.findUnique({
        where: { username: 'admin' },
      });

      if (!adminUser) {
        // Create admin user if doesn't exist
        const { randomUUID } = require('crypto');
        adminUser = await prisma.user.create({
          data: {
            id: randomUUID(),
            username: 'admin',
            email: '-',
            displayName: '최고 관리자',
            ldapDn: null,
            role: 'ADMIN',
            isVerified: true,
            updatedAt: new Date(),
          },
        });
      }

      const token = generateToken(adminUser.id, adminUser.username, adminUser.email, adminUser.displayName, adminUser.role);

      authLogger.info('Admin login successful', {
        userId: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
        ip: req.ip,
      });

      return res.json({
        token,
        user: {
          id: adminUser.id,
          username: adminUser.username,
          email: adminUser.email,
          displayName: adminUser.displayName,
          role: adminUser.role,
          isVerified: adminUser.isVerified,
          teamId: adminUser.teamId,
        },
      });
    }

    // Try LDAP authentication
    try {
      const ldapUser = await ldapService.authenticate(username, password);

      // 로그인 시 팀 배정하지 않음 - 조직도는 관리자가 수동으로 관리
      let user = await prisma.user.findUnique({
        where: { username: ldapUser.username },
      });

      if (!user) {
        // 신규 사용자: teamId = null로 생성 (관리자가 수동 배정)
        const { randomUUID } = require('crypto');
        user = await prisma.user.create({
          data: {
            id: randomUUID(),
            username: ldapUser.username,
            email: ldapUser.email,
            displayName: ldapUser.displayName,
            phoneNumber: ldapUser.phoneNumber,
            ldapDn: ldapUser.dn,
            role: 'MEMBER',
            teamId: null,
            isVerified: false,
            updatedAt: new Date(),
          },
        });
      } else {
        // 기존 사용자: teamId 유지, 기본 정보만 업데이트
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            email: ldapUser.email,
            displayName: ldapUser.displayName,
            phoneNumber: ldapUser.phoneNumber,
            ldapDn: ldapUser.dn,
            updatedAt: new Date(),
          },
        });
      }

      // Fetch user with team info for response
      const userWithTeam = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          Team: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      });

      const token = generateToken(user.id, user.username, user.email, user.displayName, user.role);

      authLogger.info('LDAP login successful', {
        userId: user.id,
        username: user.username,
        role: user.role,
        teamId: user.teamId,
        isVerified: user.isVerified,
        ip: req.ip,
      });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          isVerified: user.isVerified,
          teamId: user.teamId,
          Team: userWithTeam?.Team || null,
        },
      });
    } catch (ldapError: any) {
      // If LDAP is not configured or authentication fails
      authLogger.warn('LDAP authentication failed', {
        username: req.body.username,
        error: ldapError.message,
        ip: req.ip,
      });

      // Provide more specific error message
      let errorMsg = '인증 실패';
      if (ldapError.message && ldapError.message.includes('Invalid Credentials')) {
        errorMsg = '사용자명 또는 비밀번호가 올바르지 않습니다.';
      } else if (ldapError.message && ldapError.message.includes('timeout')) {
        errorMsg = '인증 서버에 연결할 수 없습니다. 관리자에게 문의하세요.';
      } else {
        errorMsg = '인증에 실패했습니다. 사용자명과 비밀번호를 확인하세요.';
      }

      return res.status(401).json({ error: errorMsg });
    }
  } catch (error: any) {
    errorLogger.error('Login error', {
      error: error.message,
      stack: error.stack,
      username: req.body.username,
      ip: req.ip,
    });
    res.status(401).json({ error: error.message || '인증에 실패했습니다.' });
  }
};

export const me = async (req: AuthRequest, res: Response) => {
  try {
    // Prevent caching of user info
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        teamId: true,
        isVerified: true,
        isActive: true,
        approvalRequested: true,
        approvalRequestedAt: true,
        approvalMessage: true,
        createdAt: true,
        Team: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    console.log('[AUTH /me] Returning user:', JSON.stringify({
      username: user?.username,
      displayName: user?.displayName,
      role: user?.role,
      isVerified: user?.isVerified,
    }));

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const requestApproval = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { message } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        approvalRequested: true,
        approvalRequestedAt: new Date(),
        approvalMessage: message || null,
        updatedAt: new Date(),
      },
    });

    console.log(`[APPROVAL] User ${user.username} (${user.displayName}) requested approval`);

    res.json({
      message: 'Approval request submitted successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        teamId: user.teamId,
        isVerified: user.isVerified,
        isActive: user.isActive,
        approvalRequested: user.approvalRequested,
        approvalRequestedAt: user.approvalRequestedAt,
        approvalMessage: user.approvalMessage,
      },
    });
  } catch (error: any) {
    console.error('[APPROVAL] Request approval error:', error);
    res.status(500).json({ error: error.message });
  }
};