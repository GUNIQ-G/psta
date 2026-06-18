import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../config/database';
import { UserRole } from '../types/enums';
import { randomUUID } from 'crypto';
import { errorLogger } from '../config/logger';

// 모든 권한 조회
export const getPermissions = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.query;

    let sql = `SELECT * FROM "Permission"`;
    const params: any[] = [];

    if (role) {
      params.push(role as string);
      sql += ` WHERE "role" = $1`;
    }

    sql += ` ORDER BY "role" ASC, "resource" ASC`;

    const permissions = await query(sql, params);

    res.json(permissions);
  } catch (error) {
    errorLogger.error('Get permissions error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 특정 역할의 권한 조회
export const getPermissionsByRole = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.params;

    const permissions = await query(
      `SELECT * FROM "Permission" WHERE "role" = $1 ORDER BY "resource" ASC`,
      [role]
    );

    res.json(permissions);
  } catch (error) {
    errorLogger.error('Get permissions by role error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 현재 사용자의 권한 조회
export const getMyPermissions = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user!.role;

    const permissions = await query(
      `SELECT * FROM "Permission" WHERE "role" = $1 ORDER BY "resource" ASC`,
      [userRole]
    );

    // 객체 형태로 변환하여 반환 (프론트엔드에서 사용하기 편하게)
    const permissionsMap: { [key: string]: any } = {};
    permissions.forEach((p: any) => {
      permissionsMap[p.resource] = {
        canView: p.canView,
        canCreate: p.canCreate,
        canUpdate: p.canUpdate,
        canDelete: p.canDelete,
      };
    });

    res.json({
      role: userRole,
      permissions: permissionsMap,
    });
  } catch (error) {
    errorLogger.error('Get my permissions error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 권한 업데이트
export const updatePermission = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { canView, canCreate, canUpdate, canDelete } = req.body;

    // ADMIN 권한 체크
    if (req.user!.role !== UserRole.ADMIN) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const permission = await queryOne(
      `UPDATE "Permission"
       SET "canView" = $1, "canCreate" = $2, "canUpdate" = $3, "canDelete" = $4, "updatedAt" = $5
       WHERE "id" = $6
       RETURNING *`,
      [canView, canCreate, canUpdate, canDelete, new Date(), id]
    );

    if (!permission) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(permission);
  } catch (error) {
    errorLogger.error('Update permission error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 역할별 권한 일괄 업데이트
export const updateRolePermissions = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;

    // ADMIN 권한 체크
    if (req.user!.role !== UserRole.ADMIN) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const now = new Date();

    // 각 리소스에 대한 권한 upsert
    const updates = [];
    for (const [resource, perms] of Object.entries(permissions)) {
      const perm = perms as any;
      const upsert = query(
        `INSERT INTO "Permission" ("id", "role", "resource", "canView", "canCreate", "canUpdate", "canDelete", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("role", "resource") DO UPDATE SET
           "canView" = EXCLUDED."canView",
           "canCreate" = EXCLUDED."canCreate",
           "canUpdate" = EXCLUDED."canUpdate",
           "canDelete" = EXCLUDED."canDelete",
           "updatedAt" = EXCLUDED."updatedAt"`,
        [randomUUID(), role, resource, perm.canView, perm.canCreate, perm.canUpdate, perm.canDelete, now]
      );
      updates.push(upsert);
    }

    await Promise.all(updates);

    const updatedPermissions = await query(
      `SELECT * FROM "Permission" WHERE "role" = $1 ORDER BY "resource" ASC`,
      [role]
    );

    res.json(updatedPermissions);
  } catch (error) {
    errorLogger.error('Update role permissions error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 권한 체크 헬퍼 함수 (미들웨어에서 사용)
export const checkPermission = async (
  userRole: UserRole,
  resource: string,
  action: 'view' | 'create' | 'update' | 'delete'
): Promise<boolean> => {
  try {
    const permission = await queryOne(
      `SELECT * FROM "Permission" WHERE "role" = $1 AND "resource" = $2`,
      [userRole, resource]
    );

    if (!permission) return false;

    switch (action) {
      case 'view':
        return permission.canView;
      case 'create':
        return permission.canCreate;
      case 'update':
        return permission.canUpdate;
      case 'delete':
        return permission.canDelete;
      default:
        return false;
    }
  } catch (error) {
    return false;
  }
};
