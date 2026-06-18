import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { authLogger, errorLogger } from '../config/logger';

const isAdmin = (req: AuthRequest) => req.user?.role === 'ADMIN';

// LDAP 활성화 여부 확인
const getLdapEnabled = async (): Promise<boolean> => {
  const ldapConfig = await prisma.ldapConfig.findFirst({ where: { isActive: true } });
  return !!ldapConfig;
};

// GET /api/admin/members
export const listMembers = async (req: AuthRequest, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: '관리자 권한 필요' });
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, username: true, email: true, displayName: true,
        phoneNumber: true, role: true, authType: true,
        isVerified: true, isActive: true, createdAt: true,
        teamId: true, Team: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const ldapEnabled = await getLdapEnabled();
    res.json({ users, ldapEnabled });
  } catch (err) {
    errorLogger.error('listMembers error', { err });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/admin/members
export const createMember = async (req: AuthRequest, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: '관리자 권한 필요' });

  const ldapEnabled = await getLdapEnabled();
  if (ldapEnabled) return res.status(400).json({ error: 'LDAP 사용 중에는 로컬 계정을 생성할 수 없습니다.' });

  const { username, displayName, email, phoneNumber, password, role, teamId } = req.body;
  if (!username || !displayName || !password) {
    return res.status(400).json({ error: 'username, displayName, password 필수' });
  }
  if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상' });

  try {
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return res.status(400).json({ error: '이미 존재하는 사용자명입니다.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        username,
        displayName,
        email: email || `${username}@localhost`,
        phoneNumber: phoneNumber || null,
        authType: 'LOCAL',
        passwordHash,
        role: role || 'MEMBER',
        teamId: teamId || null,
        isVerified: true,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    authLogger.info('Local member created', { by: req.user?.username, username });
    res.status(201).json({ ok: true, user });
  } catch (err: any) {
    errorLogger.error('createMember error', { err });
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

// PUT /api/admin/members/:id
export const updateMember = async (req: AuthRequest, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: '관리자 권한 필요' });

  const { id } = req.params;
  const { displayName, email, phoneNumber, role, teamId } = req.body;

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(email !== undefined && { email }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(role !== undefined && { role }),
        ...(teamId !== undefined && { teamId: teamId || null }),
        updatedAt: new Date(),
      },
    });
    res.json({ ok: true, user });
  } catch (err: any) {
    errorLogger.error('updateMember error', { err });
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

// PUT /api/admin/members/:id/toggle-active
export const toggleActive = async (req: AuthRequest, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: '관리자 권한 필요' });

  const { id } = req.params;
  if (id === req.user?.id) return res.status(400).json({ error: '본인 계정은 비활성화할 수 없습니다.' });

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: '사용자 없음' });

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive, updatedAt: new Date() },
    });
    res.json({ ok: true, isActive: updated.isActive });
  } catch (err: any) {
    errorLogger.error('toggleActive error', { err });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/admin/members/:id/reset-password
export const resetPassword = async (req: AuthRequest, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: '관리자 권한 필요' });

  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: '비밀번호는 6자 이상' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: '사용자 없음' });
    if (user.authType !== 'LOCAL') return res.status(400).json({ error: 'LOCAL 계정만 비밀번호 초기화 가능' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id }, data: { passwordHash, updatedAt: new Date() } });

    authLogger.info('Password reset by admin', { by: req.user?.username, target: user.username });
    res.json({ ok: true, message: '비밀번호가 초기화되었습니다.' });
  } catch (err: any) {
    errorLogger.error('resetPassword error', { err });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/profile  (본인 정보 수정 - LOCAL 계정 전용)
export const updateProfile = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { displayName, email, phoneNumber } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(email !== undefined && { email }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        updatedAt: new Date(),
      },
    });
    res.json({ ok: true, user: { displayName: user.displayName, email: user.email, phoneNumber: user.phoneNumber } });
  } catch (err: any) {
    errorLogger.error('updateProfile error', { err });
    res.status(500).json({ error: 'Internal server error' });
  }
};
