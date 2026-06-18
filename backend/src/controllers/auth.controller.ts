import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import ldapService from '../config/ldap';
import prisma from '../config/database';
import { generateToken, AuthRequest } from '../middleware/auth';
import { appLogger, authLogger, errorLogger } from '../config/logger';

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // LOCAL 계정 인증 (authType = 'LOCAL', DB에 passwordHash 존재)
    const localUser = await prisma.user.findUnique({
      where: { username },
    });

    if (localUser && localUser.authType === 'LOCAL' && localUser.passwordHash) {
      const valid = await bcrypt.compare(password, localUser.passwordHash);
      if (!valid) {
        authLogger.warn('Local login failed: invalid password', { username, ip: req.ip });
        return res.status(401).json({ error: '사용자명 또는 비밀번호가 올바르지 않습니다.' });
      }

      const token = generateToken(localUser.id, localUser.username, localUser.email, localUser.displayName, localUser.role);

      authLogger.info('Local login successful', {
        userId: localUser.id,
        username: localUser.username,
        role: localUser.role,
        ip: req.ip,
      });

      return res.json({
        token,
        user: {
          id: localUser.id,
          username: localUser.username,
          email: localUser.email,
          displayName: localUser.displayName,
          role: localUser.role,
          authType: localUser.authType,
          isVerified: localUser.isVerified,
          teamId: localUser.teamId,
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
    res.status(401).json({ error: '인증에 실패했습니다.' });
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
        authType: true,
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

    appLogger.debug('GET /me returning user', {
      username: user?.username,
      displayName: user?.displayName,
      role: user?.role,
      isVerified: user?.isVerified,
    });

    res.json(user);
  } catch (error) {
    errorLogger.error('Get current user error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력하세요.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '새 비밀번호는 6자 이상이어야 합니다.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user || user.authType !== 'LOCAL' || !user.passwordHash) {
      return res.status(400).json({ error: '로컬 계정만 비밀번호를 변경할 수 있습니다.' });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, updatedAt: new Date() },
    });

    authLogger.info('Password changed', { userId: user.id, username: user.username });
    res.json({ ok: true, message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    errorLogger.error('Change password error', { error });
    res.status(500).json({ error: 'Internal server error' });
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

    authLogger.info('User requested approval', {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
    });

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
  } catch (error) {
    errorLogger.error('Request approval error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};