import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getSoftDeletedItems, restoreItem, permanentlyDeleteItem } from '../services/soft-delete.service';
import { appLogger, errorLogger } from '../config/logger';
import { UserRole, ItemType } from '@prisma/client';
import prisma from '../config/database';

/**
 * 휴지통 항목 조회 (권한별 필터링)
 * GET /api/trash
 */
export const getTrashItems = async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: '인증이 필요합니다' });
    }

    const { type, limit } = req.query;

    const options: any = {
      limit: limit ? parseInt(limit as string) : 100,
      userId: currentUser.id,
      userRole: currentUser.role,
    };

    if (type) {
      options.type = type as string;
    }

    const deletedItems = await getSoftDeletedItems(options);

    appLogger.info('Trash items retrieved', {
      userId: currentUser.id,
      username: currentUser.username,
      userRole: currentUser.role,
      count: deletedItems.length,
      type: type || 'ALL',
    });

    res.status(200).json(deletedItems);
  } catch (error: any) {
    errorLogger.error('Failed to get trash items', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });
    res.status(500).json({ error: '휴지통 조회 실패: ' + error.message });
  }
};

/**
 * Check if user has permission to restore an item
 */
async function canRestoreItem(userId: string, userRole: UserRole, itemId: string): Promise<{ allowed: boolean; reason?: string }> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, type: true, createdById: true, assigneeId: true },
  });

  if (!item) {
    return { allowed: false, reason: '항목을 찾을 수 없습니다' };
  }

  // ADMIN can restore everything
  if (userRole === UserRole.ADMIN) {
    return { allowed: true };
  }

  // PO can restore projects
  if (userRole === UserRole.PO && item.type === ItemType.PROJECT) {
    return { allowed: true };
  }

  // PM can restore services and teams
  if (userRole === UserRole.PM && (item.type === ItemType.SERVICE || item.type === ItemType.TEAM)) {
    return { allowed: true };
  }

  // MEMBER can only restore actions they created
  if (item.type === ItemType.ACTION && item.createdById === userId) {
    return { allowed: true };
  }

  return { allowed: false, reason: '복원 권한이 없습니다' };
}

/**
 * 항목 복원 (권한별 체크)
 * POST /api/trash/:id/restore
 */
export const restoreTrashItem = async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: '인증이 필요합니다' });
    }

    const { id } = req.params;

    // Check restore permission
    const permission = await canRestoreItem(currentUser.id, currentUser.role, id);
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.reason });
    }

    const restoredItem = await restoreItem(id);

    appLogger.info('Item restored from trash', {
      itemId: id,
      itemName: restoredItem.name,
      itemType: restoredItem.type,
      restoredBy: currentUser.id,
      restoredByUsername: currentUser.username,
      restoredByRole: currentUser.role,
    });

    res.status(200).json({
      message: '복원되었습니다',
      item: restoredItem,
    });
  } catch (error: any) {
    errorLogger.error('Failed to restore item', {
      error: error.message,
      stack: error.stack,
      itemId: req.params.id,
      userId: req.user?.id,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: '삭제된 항목을 찾을 수 없습니다' });
    }

    res.status(500).json({ error: '복원 실패: ' + error.message });
  }
};

/**
 * Check if user has permission to permanently delete an item
 */
async function canPermanentlyDeleteItem(userId: string, userRole: UserRole, itemId: string): Promise<{ allowed: boolean; reason?: string }> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, type: true, createdById: true },
  });

  if (!item) {
    return { allowed: false, reason: '항목을 찾을 수 없습니다' };
  }

  // ADMIN can delete everything
  if (userRole === UserRole.ADMIN) {
    return { allowed: true };
  }

  // PO can delete projects
  if (userRole === UserRole.PO && item.type === ItemType.PROJECT) {
    return { allowed: true };
  }

  // PM can delete services and teams
  if (userRole === UserRole.PM && (item.type === ItemType.SERVICE || item.type === ItemType.TEAM)) {
    return { allowed: true };
  }

  // Creator can delete their own items
  if (item.createdById === userId) {
    return { allowed: true };
  }

  return { allowed: false, reason: '영구 삭제 권한이 없습니다' };
}

/**
 * 항목 영구 삭제 (권한별 체크)
 * DELETE /api/trash/:id
 */
export const permanentlyDeleteTrashItem = async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: '인증이 필요합니다' });
    }

    const { id } = req.params;

    // Check delete permission
    const permission = await canPermanentlyDeleteItem(currentUser.id, currentUser.role, id);
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.reason });
    }

    await permanentlyDeleteItem(id);

    appLogger.info('Item permanently deleted from trash', {
      itemId: id,
      deletedBy: currentUser.id,
      deletedByUsername: currentUser.username,
      deletedByRole: currentUser.role,
    });

    res.status(200).json({
      message: '영구 삭제되었습니다',
    });
  } catch (error: any) {
    errorLogger.error('Failed to permanently delete item', {
      error: error.message,
      stack: error.stack,
      itemId: req.params.id,
      userId: req.user?.id,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: '삭제된 항목을 찾을 수 없습니다' });
    }

    res.status(500).json({ error: '영구 삭제 실패: ' + error.message });
  }
};
