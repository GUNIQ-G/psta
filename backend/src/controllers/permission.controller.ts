import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';

// 모든 권한 조회
export const getPermissions = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.query;

    const where: any = {};
    if (role) where.role = role as UserRole;

    const permissions = await prisma.permission.findMany({
      where,
      orderBy: [{ role: 'asc' }, { resource: 'asc' }],
    });

    res.json(permissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 특정 역할의 권한 조회
export const getPermissionsByRole = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.params;

    const permissions = await prisma.permission.findMany({
      where: { role: role as UserRole },
      orderBy: { resource: 'asc' },
    });

    res.json(permissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 현재 사용자의 권한 조회
export const getMyPermissions = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user!.role;

    const permissions = await prisma.permission.findMany({
      where: { role: userRole },
      orderBy: { resource: 'asc' },
    });

    // 객체 형태로 변환하여 반환 (프론트엔드에서 사용하기 편하게)
    const permissionsMap: { [key: string]: any } = {};
    permissions.forEach(p => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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

    const permission = await prisma.permission.update({
      where: { id },
      data: {
        canView,
        canCreate,
        canUpdate,
        canDelete,
        updatedAt: new Date(),
      },
    });

    res.json(permission);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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

    // 각 리소스에 대한 권한 업데이트
    const updates = [];
    for (const [resource, perms] of Object.entries(permissions)) {
      const perm = perms as any;
      const update = prisma.permission.upsert({
        where: {
          role_resource: {
            role: role as UserRole,
            resource,
          },
        },
        update: {
          canView: perm.canView,
          canCreate: perm.canCreate,
          canUpdate: perm.canUpdate,
          canDelete: perm.canDelete,
          updatedAt: new Date(),
        },
        create: {
          id: randomUUID(),
          role: role as UserRole,
          resource,
          canView: perm.canView,
          canCreate: perm.canCreate,
          canUpdate: perm.canUpdate,
          canDelete: perm.canDelete,
          updatedAt: new Date(),
        },
      });
      updates.push(update);
    }

    await Promise.all(updates);

    const updatedPermissions = await prisma.permission.findMany({
      where: { role: role as UserRole },
      orderBy: { resource: 'asc' },
    });

    res.json(updatedPermissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 권한 체크 헬퍼 함수 (미들웨어에서 사용)
export const checkPermission = async (
  userRole: UserRole,
  resource: string,
  action: 'view' | 'create' | 'update' | 'delete'
): Promise<boolean> => {
  try {
    const permission = await prisma.permission.findUnique({
      where: {
        role_resource: {
          role: userRole,
          resource,
        },
      },
    });

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
