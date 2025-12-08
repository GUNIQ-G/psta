/**
 * Soft Delete Service
 *
 * Provides utilities for soft deleting items and their related data.
 * Implements recursive soft delete for hierarchical items (PROJECT -> SERVICE -> TEAM -> ACTION).
 */

import prisma from '../config/database';
import { ItemType } from '@prisma/client';
import { appLogger } from '../config/logger';
import { randomUUID } from 'crypto';

interface SoftDeleteOptions {
  userId: string;
  recursive?: boolean;
}

/**
 * Recursively soft delete an Item and all its children
 */
export async function softDeleteItem(
  itemId: string,
  options: SoftDeleteOptions
): Promise<{ deletedCount: number; deletedItems: string[] }> {
  const { userId, recursive = true } = options;
  const deletedItems: string[] = [];
  let deletedCount = 0;

  try {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        other_Item: true, // Children items
      },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    if (item.isDeleted) {
      throw new Error('Item is already deleted');
    }

    // If recursive, soft delete all children first
    if (recursive && item.other_Item.length > 0) {
      for (const child of item.other_Item) {
        if (!child.isDeleted) {
          const result = await softDeleteItem(child.id, { userId, recursive: true });
          deletedCount += result.deletedCount;
          deletedItems.push(...result.deletedItems);
        }
      }
    }

    // Soft delete the item itself
    await prisma.item.update({
      where: { id: itemId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: userId,
      },
    });

    deletedItems.push(itemId);
    deletedCount++;

    // Also soft delete related Comments, Files, and Links
    await softDeleteRelatedData(itemId, userId);

    appLogger.info('Item soft deleted', {
      itemId,
      itemName: item.name,
      itemType: item.type,
      deletedBy: userId,
      childrenDeleted: deletedCount - 1,
    });

    return { deletedCount, deletedItems };
  } catch (error: any) {
    appLogger.error('Failed to soft delete item', {
      itemId,
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Soft delete related data (Comments, Files, Links) for an Item
 */
async function softDeleteRelatedData(itemId: string, userId: string): Promise<void> {
  const now = new Date();

  // Soft delete Comments
  await prisma.comment.updateMany({
    where: { itemId, isDeleted: false },
    data: {
      isDeleted: true,
      deletedAt: now,
      deletedById: userId,
    },
  });

  // Soft delete Files
  await prisma.file.updateMany({
    where: { itemId, isDeleted: false },
    data: {
      isDeleted: true,
      deletedAt: now,
      deletedById: userId,
    },
  });

  // Soft delete Links
  await prisma.link.updateMany({
    where: { itemId, isDeleted: false },
    data: {
      isDeleted: true,
      deletedAt: now,
      deletedById: userId,
    },
  });
}

/**
 * Soft delete a WorkRequest
 */
export async function softDeleteWorkRequest(
  workRequestId: string,
  userId: string
): Promise<void> {
  try {
    const workRequest = await prisma.workRequest.findUnique({
      where: { id: workRequestId },
    });

    if (!workRequest) {
      throw new Error('WorkRequest not found');
    }

    if (workRequest.isDeleted) {
      throw new Error('WorkRequest is already deleted');
    }

    await prisma.workRequest.update({
      where: { id: workRequestId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: userId,
      },
    });

    appLogger.info('WorkRequest soft deleted', {
      workRequestId,
      workRequestTitle: workRequest.title,
      deletedBy: userId,
    });
  } catch (error: any) {
    appLogger.error('Failed to soft delete WorkRequest', {
      workRequestId,
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Restore a soft-deleted Item
 */
export async function restoreItem(itemId: string) {
  try {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    if (!item.isDeleted) {
      throw new Error('Item is not deleted');
    }

    const restoredItem = await prisma.item.update({
      where: { id: itemId },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
      },
    });

    appLogger.info('Item restored', {
      itemId,
      itemName: item.name,
      itemType: item.type,
    });

    return restoredItem;
  } catch (error: any) {
    appLogger.error('Failed to restore item', {
      itemId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Permanently delete a soft-deleted Item (hard delete)
 */
export async function permanentlyDeleteItem(itemId: string): Promise<void> {
  try {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    if (!item.isDeleted) {
      throw new Error('Item must be soft deleted before permanent deletion');
    }

    // First delete related data
    await prisma.comment.deleteMany({ where: { itemId } });
    await prisma.file.deleteMany({ where: { itemId } });
    await prisma.link.deleteMany({ where: { itemId } });

    // Then delete the item
    await prisma.item.delete({ where: { id: itemId } });

    appLogger.info('Item permanently deleted', {
      itemId,
      itemName: item.name,
      itemType: item.type,
    });
  } catch (error: any) {
    appLogger.error('Failed to permanently delete item', {
      itemId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get soft-deleted items with role-based filtering
 */
export async function getSoftDeletedItems(options?: {
  type?: ItemType;
  deletedAfter?: Date;
  limit?: number;
  userId?: string;
  userRole?: string;
}) {
  const { type, deletedAfter, limit = 100, userId, userRole } = options || {};

  const where: any = { isDeleted: true };
  if (type) where.type = type;
  if (deletedAfter) where.deletedAt = { gte: deletedAfter };

  // Role-based filtering: non-admin users only see items they created or are assigned to
  if (userRole !== 'ADMIN' && userId) {
    where.OR = [
      { createdById: userId },    // Created by user
      { assigneeId: userId },      // Assigned to user
    ];
  }

  return prisma.item.findMany({
    where,
    include: {
      User_Item_deletedByIdToUser: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      User_Item_assigneeIdToUser: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      User_Item_createdByIdToUser: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      Client: true,
      _count: {
        select: {
          other_Item: {
            where: { isDeleted: true }, // Count deleted children
          },
        },
      },
    },
    orderBy: { deletedAt: 'desc' },
    take: limit,
  });
}

/**
 * Find or create "미정 프로젝트" and "미정 서비스"
 */
async function findOrCreateUndecidedHierarchy(userId: string, projectId?: string) {
  // Find or create "미정 프로젝트"
  let undecidedProject = await prisma.item.findFirst({
    where: {
      type: ItemType.PROJECT,
      name: { contains: '미정' },
      isDeleted: false,
    },
  });

  if (!undecidedProject) {
    undecidedProject = await prisma.item.create({
      data: {
        id: randomUUID(),
        name: '미정 프로젝트',
        type: ItemType.PROJECT,
        status: 'NOT_STARTED',
        progress: 0,
        description: '프로젝트가 미정인 항목들을 위한 임시 프로젝트',
        createdById: userId,
        updatedAt: new Date(),
      },
    });
  }

  // Determine which project to use for the undecided service
  const targetProjectId = projectId || undecidedProject.id;

  // Find or create "미정 서비스" under the target project
  let undecidedService = await prisma.item.findFirst({
    where: {
      type: ItemType.SERVICE,
      name: { contains: '미정' },
      parentId: targetProjectId,
      isDeleted: false,
    },
  });

  if (!undecidedService) {
    undecidedService = await prisma.item.create({
      data: {
        id: randomUUID(),
        name: '미정 서비스',
        type: ItemType.SERVICE,
        status: 'NOT_STARTED',
        progress: 0,
        parentId: targetProjectId,
        description: '서비스가 미정인 항목들을 위한 임시 서비스',
        createdById: userId,
        updatedAt: new Date(),
      },
    });
  }

  return { undecidedProject, undecidedService };
}

/**
 * Move teams to undecided hierarchy
 */
export async function moveTeamsToUndecided(
  teamIds: string[],
  userId: string,
  targetProjectId?: string
): Promise<{ movedCount: number }> {
  const { undecidedService } = await findOrCreateUndecidedHierarchy(userId, targetProjectId);

  let movedCount = 0;

  for (const teamId of teamIds) {
    await prisma.item.update({
      where: { id: teamId },
      data: { parentId: undecidedService.id },
    });
    movedCount++;
  }

  appLogger.info('Teams moved to undecided hierarchy', {
    teamCount: movedCount,
    targetServiceId: undecidedService.id,
  });

  return { movedCount };
}

/**
 * Soft delete PROJECT with team preservation
 * Moves all teams to "미정 프로젝트 > 미정 서비스"
 */
export async function softDeleteProjectWithTeamPreservation(
  projectId: string,
  userId: string
): Promise<{ deletedCount: number; movedTeamCount: number; actionCount: number }> {
  // Get all services under the project
  const services = await prisma.item.findMany({
    where: {
      parentId: projectId,
      type: ItemType.SERVICE,
      isDeleted: false,
    },
  });

  // Get all teams under all services
  const allTeamIds: string[] = [];
  let totalActionCount = 0;

  for (const service of services) {
    const teams = await prisma.item.findMany({
      where: {
        parentId: service.id,
        type: ItemType.TEAM,
        isDeleted: false,
      },
      include: {
        other_Item: {
          where: {
            type: ItemType.ACTION,
            isDeleted: false,
          },
        },
      },
    });

    for (const team of teams) {
      allTeamIds.push(team.id);
      totalActionCount += team.other_Item.length;
    }
  }

  // Move teams to undecided hierarchy
  const { movedCount } = await moveTeamsToUndecided(allTeamIds, userId);

  // Soft delete the project and all services (teams are already moved)
  const deleteResult = await softDeleteItem(projectId, { userId, recursive: true });

  appLogger.info('Project soft deleted with team preservation', {
    projectId,
    deletedCount: deleteResult.deletedCount,
    movedTeamCount: movedCount,
    actionCount: totalActionCount,
  });

  return {
    deletedCount: deleteResult.deletedCount,
    movedTeamCount: movedCount,
    actionCount: totalActionCount,
  };
}

/**
 * Soft delete SERVICE with team preservation
 * Moves all teams to "[same project] > 미정 서비스"
 */
export async function softDeleteServiceWithTeamPreservation(
  serviceId: string,
  userId: string
): Promise<{ deletedCount: number; movedTeamCount: number; actionCount: number }> {
  // Get the service to find its parent project
  const service = await prisma.item.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw new Error('Service not found');
  }

  // Get all teams under the service
  const teams = await prisma.item.findMany({
    where: {
      parentId: serviceId,
      type: ItemType.TEAM,
      isDeleted: false,
    },
    include: {
      other_Item: {
        where: {
          type: ItemType.ACTION,
          isDeleted: false,
        },
      },
    },
  });

  const teamIds = teams.map(t => t.id);
  const totalActionCount = teams.reduce((sum, team) => sum + team.other_Item.length, 0);

  // v1.1.18: Get all ServiceTeams linked to this service
  const serviceTeams = await prisma.serviceTeam.findMany({
    where: {
      serviceId: serviceId,
    },
    select: {
      id: true,
    },
  });

  const serviceTeamIds = serviceTeams.map(st => st.id);

  // v1.1.18: Soft delete all actions linked to these ServiceTeams
  let deletedActionCount = 0;
  if (serviceTeamIds.length > 0) {
    const actionsToDelete = await prisma.item.findMany({
      where: {
        serviceTeamId: { in: serviceTeamIds },
        type: ItemType.ACTION,
        isDeleted: false,
      },
      select: { id: true },
    });

    for (const action of actionsToDelete) {
      await softDeleteItem(action.id, { userId, recursive: false });
      deletedActionCount++;
    }

    appLogger.info('Soft deleted actions linked to service', {
      serviceId,
      deletedActionCount,
    });
  }

  // Move teams to undecided service under the same project
  const { movedCount } = await moveTeamsToUndecided(teamIds, userId, service.parentId || undefined);

  // Soft delete the service (teams are already moved)
  const deleteResult = await softDeleteItem(serviceId, { userId, recursive: true });

  appLogger.info('Service soft deleted with team preservation', {
    serviceId,
    deletedCount: deleteResult.deletedCount,
    movedTeamCount: movedCount,
    actionCount: totalActionCount + deletedActionCount,
  });

  return {
    deletedCount: deleteResult.deletedCount + deletedActionCount,
    movedTeamCount: movedCount,
    actionCount: totalActionCount + deletedActionCount,
  };
}

export default {
  softDeleteItem,
  softDeleteWorkRequest,
  restoreItem,
  permanentlyDeleteItem,
  getSoftDeletedItems,
  moveTeamsToUndecided,
  softDeleteProjectWithTeamPreservation,
  softDeleteServiceWithTeamPreservation,
};
