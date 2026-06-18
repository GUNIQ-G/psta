import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { query, queryOne } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { authLogger, errorLogger } from '../config/logger';

const isAdmin = (req: AuthRequest) => req.user?.role === 'ADMIN';

// LDAP 활성화 여부 확인
const getLdapEnabled = async (): Promise<boolean> => {
  const ldapConfig = await queryOne<any>(
    `SELECT "id" FROM "LdapConfig" WHERE "isActive" = true LIMIT 1`
  );
  return !!ldapConfig;
};

// GET /api/admin/members
export const listMembers = async (req: AuthRequest, res: Response) => {
  if (!isAdmin(req)) return res.status(403).json({ error: '관리자 권한 필요' });
  try {
    const rows = await query<any>(
      `SELECT u."id", u."username", u."email", u."displayName",
              u."phoneNumber", u."role", u."authType",
              u."isVerified", u."isActive", u."createdAt",
              u."teamId",
              t."id" AS "team_id", t."name" AS "team_name"
       FROM "User" u
       LEFT JOIN "Team" t ON t."id" = u."teamId"
       ORDER BY u."createdAt" ASC`
    );

    const users = rows.map((r: any) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      displayName: r.displayName,
      phoneNumber: r.phoneNumber,
      role: r.role,
      authType: r.authType,
      isVerified: r.isVerified,
      isActive: r.isActive,
      createdAt: r.createdAt,
      teamId: r.teamId,
      Team: r.team_id ? { id: r.team_id, name: r.team_name } : null,
    }));

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
    const exists = await queryOne<any>(
      `SELECT "id" FROM "User" WHERE "username" = $1`,
      [username]
    );
    if (exists) return res.status(400).json({ error: '이미 존재하는 사용자명입니다.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await queryOne<any>(
      `INSERT INTO "User" (
        "id", "username", "displayName", "email", "phoneNumber",
        "authType", "passwordHash", "role", "teamId",
        "isVerified", "isActive", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, 'LOCAL', $6, $7, $8, true, true, $9)
       RETURNING *`,
      [
        randomUUID(),
        username,
        displayName,
        email || `${username}@localhost`,
        phoneNumber || null,
        passwordHash,
        role || 'MEMBER',
        teamId || null,
        new Date(),
      ]
    );

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
    const existing = await queryOne<any>(`SELECT * FROM "User" WHERE "id" = $1`, [id]);
    if (!existing) return res.status(404).json({ error: '사용자 없음' });

    const user = await queryOne<any>(
      `UPDATE "User"
       SET "displayName" = $1, "email" = $2, "phoneNumber" = $3,
           "role" = $4, "teamId" = $5, "updatedAt" = $6
       WHERE "id" = $7
       RETURNING *`,
      [
        displayName !== undefined ? displayName : existing.displayName,
        email !== undefined ? email : existing.email,
        phoneNumber !== undefined ? phoneNumber : existing.phoneNumber,
        role !== undefined ? role : existing.role,
        teamId !== undefined ? (teamId || null) : existing.teamId,
        new Date(),
        id,
      ]
    );
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
    const user = await queryOne<any>(`SELECT * FROM "User" WHERE "id" = $1`, [id]);
    if (!user) return res.status(404).json({ error: '사용자 없음' });

    const updated = await queryOne<any>(
      `UPDATE "User" SET "isActive" = $1, "updatedAt" = $2 WHERE "id" = $3 RETURNING "isActive"`,
      [!user.isActive, new Date(), id]
    );
    res.json({ ok: true, isActive: updated!.isActive });
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
    const user = await queryOne<any>(`SELECT * FROM "User" WHERE "id" = $1`, [id]);
    if (!user) return res.status(404).json({ error: '사용자 없음' });
    if (user.authType !== 'LOCAL') return res.status(400).json({ error: 'LOCAL 계정만 비밀번호 초기화 가능' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(
      `UPDATE "User" SET "passwordHash" = $1, "updatedAt" = $2 WHERE "id" = $3`,
      [passwordHash, new Date(), id]
    );

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
    const existing = await queryOne<any>(`SELECT * FROM "User" WHERE "id" = $1`, [req.user.id]);
    if (!existing) return res.status(404).json({ error: '사용자 없음' });

    const user = await queryOne<any>(
      `UPDATE "User"
       SET "displayName" = $1, "email" = $2, "phoneNumber" = $3, "updatedAt" = $4
       WHERE "id" = $5
       RETURNING "displayName", "email", "phoneNumber"`,
      [
        displayName !== undefined ? displayName : existing.displayName,
        email !== undefined ? email : existing.email,
        phoneNumber !== undefined ? phoneNumber : existing.phoneNumber,
        new Date(),
        req.user.id,
      ]
    );
    res.json({ ok: true, user: { displayName: user!.displayName, email: user!.email, phoneNumber: user!.phoneNumber } });
  } catch (err: any) {
    errorLogger.error('updateProfile error', { err });
    res.status(500).json({ error: 'Internal server error' });
  }
};
