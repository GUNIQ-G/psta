import { Request, Response } from 'express';
import path from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../config/database';
import { isInstalled, markInstalled } from '../config/install';
import appLogger from '../config/logger';

// GET /install/status
export const getInstallStatus = async (req: Request, res: Response) => {
  if (isInstalled()) {
    return res.json({ installed: true });
  }

  let dbConnected = false;
  try {
    await queryOne('SELECT 1');
    dbConnected = true;
  } catch {}

  res.json({ installed: false, dbConnected });
};

// POST /install/test-db
export const testDbConnection = async (req: Request, res: Response) => {
  const { databaseUrl } = req.body;
  if (!databaseUrl) {
    return res.status(400).json({ error: 'databaseUrl 필수' });
  }
  const { Pool } = await import('pg');
  const testPool = new Pool({ connectionString: databaseUrl });
  try {
    await testPool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  } finally {
    await testPool.end();
  }
};

// POST /install/run
export const runInstall = async (req: Request, res: Response) => {
  if (isInstalled()) {
    return res.status(400).json({ error: '이미 설치되어 있습니다' });
  }

  const { frontendUrl, adminPassword } = req.body;

  if (!adminPassword || adminPassword.length < 6) {
    return res.status(400).json({ error: '관리자 비밀번호는 6자 이상이어야 합니다.' });
  }

  try {
    // 1. 스키마 적용
    appLogger.info('[Install] applying schema.sql...');
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.sql');
    const dbUrl = (process.env.DATABASE_URL || '').replace(/\?.*$/, '');
    execSync(`psql "${dbUrl}" -f "${schemaPath}"`, {
      env: { ...process.env },
      stdio: 'pipe',
    });
    appLogger.info('[Install] schema applied');

    // 2. 기본 시스템 설정 seed
    const now = new Date();
    const defaultSettings = [
      { key: 'systemName',        value: 'PSTA' },
      { key: 'systemDescription', value: 'Project-Service-Team-Action 관리 시스템' },
      { key: 'systemLogo',        value: '/psta-logo.png' },
      { key: 'favicon',           value: '/psta-favicon.png' },
      { key: 'copyrightText',     value: 'PSTA. All rights reserved.' },
      { key: 'frontendUrl',       value: frontendUrl || process.env.FRONTEND_URL || '' },
    ];

    for (const s of defaultSettings) {
      await query(
        `INSERT INTO "SystemSetting" (id, key, value, category, "isEncrypted", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'general', false, $4, $4)
         ON CONFLICT (key) DO UPDATE SET value = $3, "updatedAt" = $4`,
        [randomUUID(), s.key, s.value, now]
      );
    }

    // 3. 기본 권한 seed
    const resources = [
      'dashboard', 'requests', 'psta', 'wbs', 'report', 'integrated-files',
      'organization', 'clients', 'projects', 'services', 'team-status', 'actions',
      'teams', 'users', 'feedback', 'user-approval', 'general-settings', 'members',
      'ldap-auth', 'ldap-sync', 'notification-apps', 'permissions',
    ];
    const roles = ['ADMIN', 'PO', 'PM', 'MEMBER'] as const;
    const roleDefaults: Record<string, { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }> = {
      ADMIN:  { canView: true,  canCreate: true,  canUpdate: true,  canDelete: true  },
      PO:     { canView: true,  canCreate: true,  canUpdate: true,  canDelete: false },
      PM:     { canView: true,  canCreate: true,  canUpdate: true,  canDelete: false },
      MEMBER: { canView: true,  canCreate: false, canUpdate: false, canDelete: false },
    };
    for (const role of roles) {
      const perms = roleDefaults[role];
      for (const resource of resources) {
        await query(
          `INSERT INTO "Permission" (id, role, resource, "canView", "canCreate", "canUpdate", "canDelete", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
           ON CONFLICT (role, resource) DO NOTHING`,
          [randomUUID(), role, resource, perms.canView, perms.canCreate, perms.canUpdate, perms.canDelete, now]
        );
      }
    }
    appLogger.info('[Install] default permissions seeded');

    // 4. admin 계정 생성
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await query(
      `INSERT INTO "User" (id, username, email, "displayName", "authType", "passwordHash", role, "isVerified", "isActive", "updatedAt")
       VALUES ($1, 'admin', 'admin@localhost', '최고 관리자', 'LOCAL', $2, 'ADMIN', true, true, $3)
       ON CONFLICT (username) DO UPDATE SET "passwordHash" = $2, "authType" = 'LOCAL', "updatedAt" = $3`,
      [randomUUID(), passwordHash, now]
    );
    appLogger.info('[Install] admin user created');

    if (frontendUrl) {
      process.env.FRONTEND_URL = frontendUrl;
    }

    markInstalled();
    appLogger.info('[Install] installation complete');

    res.json({ ok: true, message: '설치가 완료되었습니다. 로그인 페이지로 이동하세요.' });
  } catch (err: any) {
    appLogger.error('[Install] failed:', err);
    res.status(500).json({ error: err.message || '설치 중 오류 발생' });
  }
};
