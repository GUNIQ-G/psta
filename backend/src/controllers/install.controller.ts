import { Request, Response } from 'express';
import { execSync } from 'child_process';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { isInstalled, markInstalled } from '../config/install';
import appLogger from '../config/logger';

// GET /install/status
export const getInstallStatus = async (req: Request, res: Response) => {
  if (isInstalled()) {
    return res.json({ installed: true });
  }

  // DB 연결 테스트
  let dbConnected = false;
  try {
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
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
  try {
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
};

// POST /install/run
export const runInstall = async (req: Request, res: Response) => {
  if (isInstalled()) {
    return res.status(400).json({ error: '이미 설치되어 있습니다' });
  }

  const { frontendUrl } = req.body;

  try {
    // 1. Prisma 마이그레이션
    appLogger.info('[Install] running prisma migrate deploy...');
    const prismaPath = path.join(process.cwd(), 'node_modules', '.bin', 'prisma');
    execSync(`${prismaPath} migrate deploy`, {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: 'pipe',
    });
    appLogger.info('[Install] migration complete');

    // 2. 기본 권한 seeding (Permission 테이블)
    const prisma = new PrismaClient();

    // 3. FRONTEND_URL 업데이트 (환경변수는 런타임에만 영향)
    if (frontendUrl) {
      process.env.FRONTEND_URL = frontendUrl;
    }

    await prisma.$disconnect();

    // 4. 설치 완료 표시
    markInstalled();
    appLogger.info('[Install] installation complete');

    res.json({ ok: true, message: '설치가 완료되었습니다. 로그인 페이지로 이동하세요.' });
  } catch (err: any) {
    appLogger.error('[Install] failed:', err);
    res.status(500).json({ error: err.message || '설치 중 오류 발생' });
  }
};
