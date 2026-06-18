/**
 * Soft Delete Service
 *
 * Provides utilities for soft deleting items and their related data.
 * Implements recursive soft delete for hierarchical items (PROJECT -> SERVICE -> TEAM -> ACTION).
 */

import { query, queryOne } from '../config/database';
import { ItemType } from '../types/enums';
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
    const item = await queryOne<{
      id: string;
      name: string;
      type: string;
      isDeleted: boolean;
    }>(
      `SELECT "id", "name", "type", "isDeleted" FROM "Item" WHERE id = $1`,
      [itemId]
    );

    if (!item) {
      throw new Error('Item not found');
    }

    if (item.isDeleted) {
      throw new Error('Item is already deleted');
    }

    // If recursive, soft delete all children first
    if (recursive) {
      const children = await query<{ id: string; isDeleted: boolean }>(
        `SELECT "id", "isDeleted" FROM "Item" WHERE "parentId" = $1`,
        [itemId]
      );

      for (const child of children) {
        if (!child.isDeleted) {
          const result = await softDeleteItem(child.id, { userId, recursive: true });
          deletedCount += result.deletedCount;
          deletedItems.push(...result.deletedItems);
        }
      }
    }

    // Soft delete the item itself
    await query(
      `UPDATE "Item" SET "isDeleted" = true, "deletedAt" = $1, "deletedById" = $2 WHERE id = $3`,
      [new Date(), userId, itemId]
    );

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
  await query(
    `UPDATE "Comment" SET "isDeleted" = true, "deletedAt" = $1, "deletedById" = $2
     WHERE "itemId" = $3 AND "isDeleted" = false`,
    [now, userId, itemId]
  );

  // Soft delete Files
  await query(
    `UPDATE "File" SET "isDeleted" = true, "deletedAt" = $1, "deletedById" = $2
     WHERE "itemId" = $3 AND "isDeleted" = false`,
    [now, userId, itemId]
  );

  // Soft delete Links
  await query(
    `UPDATE "Link" SET "isDeleted" = true, "deletedAt" = $1, "deletedById" = $2
     WHERE "itemId" = $3 AND "isDeleted" = false`,
    [now, userId, itemId]
  );
}

/**
 * Soft delete a WorkRequest
 */
export async function softDeleteWorkRequest(
  workRequestId: string,
  userId: string
): Promise<void> {
  try {
    const workRequest = await queryOne<{ id: string; title: string; isDeleted: boolean }>(
      `SELECT "id", "title", "isDeleted" FROM "WorkRequest" WHERE id = $1`,
      [workRequestId]
    );

    if (!workRequest) {
      throw new Error('WorkRequest not found');
    }

    if (workRequest.isDeleted) {
      throw new Error('WorkRequest is already deleted');
    }

    await query(
      `UPDATE "WorkRequest" SET "isDeleted" = true, "deletedAt" = $1, "deletedById" = $2 WHERE id = $3`,
      [new Date(), userId, workRequestId]
    );

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
    const item = await queryOne<{ id: string; name: string; type: string; isDeleted: boolean }>(
      `SELECT "id", "name", "type", "isDeleted" FROM "Item" WHERE id = $1`,
      [itemId]
    );

    if (!item) {
      throw new Error('Item not found');
    }

    if (!item.isDeleted) {
      throw new Error('Item is not deleted');
    }

    const restoredItem = await queryOne<any>(
      `UPDATE "Item" SET "isDeleted" = false, "deletedAt" = NULL, "deletedById" = NULL
       WHERE id = $1 RETURNING *`,
      [itemId]
    );

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
    const item = await queryOne<{ id: string; name: string; type: string; isDeleted: boolean }>(
      `SELECT "id", "name", "type", "isDeleted" FROM "Item" WHERE id = $1`,
      [itemId]
    );

    if (!item) {
      throw new Error('Item not found');
    }

    if (!item.isDeleted) {
      throw new Error('Item must be soft deleted before permanent deletion');
    }

    // First delete related data
    await query(`DELETE FROM "Comment" WHERE "itemId" = $1`, [itemId]);
    await query(`DELETE FROM "File" WHERE "itemId" = $1`, [itemId]);
    await query(`DELETE FROM "Link" WHERE "itemId" = $1`, [itemId]);

    // Then delete the item
    await query(`DELETE FROM "Item" WHERE id = $1`, [itemId]);

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

  const params: any[] = [];
  let paramIndex = 1;

  let whereClause = `i."isDeleted" = true`;

  if (type) {
    whereClause += ` AND i."type" = $${paramIndex++}`;
    params.push(type);
  }

  if (deletedAfter) {
    whereClause += ` AND i."deletedAt" >= $${paramIndex++}`;
    params.push(deletedAfter);
  }

  // Role-based filtering: non-admin users only see items they created or are assigned to
  if (userRole !== 'ADMIN' && userId) {
    whereClause += ` AND (i."createdById" = $${paramIndex} OR i."assigneeId" = $${paramIndex + 1})`;
    params.push(userId, userId);
    paramIndex += 2;
  }

  params.push(limit);
  const limitParam = paramIndex;

  const rows = await query<any>(
    `SELECT
       i.*,
       del_user.id AS "deletedBy_id",
       del_user.username AS "deletedBy_username",
       del_user."displayName" AS "deletedBy_displayName",
       asgn_user.id AS "assignee_id",
       asgn_user.username AS "assignee_username",
       asgn_user."displayName" AS "assignee_displayName",
       cr_user.id AS "createdBy_id",
       cr_user.username AS "createdBy_username",
       cr_user."displayName" AS "createdBy_displayName",
       c.id AS "client_id",
       c.name AS "client_name",
       c.code AS "client_code",
       c.description AS "client_description",
       c."logoUrl" AS "client_logoUrl",
       c."isActive" AS "client_isActive",
       c."createdAt" AS "client_createdAt",
       c."updatedAt" AS "client_updatedAt",
       (SELECT COUNT(*) FROM "Item" child WHERE child."parentId" = i.id AND child."isDeleted" = true)::int AS "deletedChildrenCount"
     FROM "Item" i
     LEFT JOIN "User" del_user ON del_user.id = i."deletedById"
     LEFT JOIN "User" asgn_user ON asgn_user.id = i."assigneeId"
     LEFT JOIN "User" cr_user ON cr_user.id = i."createdById"
     LEFT JOIN "Client" c ON c.id = i."clientId"
     WHERE ${whereClause}
     ORDER BY i."deletedAt" DESC
     LIMIT $${limitParam}`,
    params
  );

  // Transform flat rows to nested structure matching original Prisma include shape
  return rows.map((row) => {
    const {
      deletedBy_id, deletedBy_username, deletedBy_displayName,
      assignee_id, assignee_username, assignee_displayName,
      createdBy_id, createdBy_username, createdBy_displayName,
      client_id, client_name, client_code, client_description,
      client_logoUrl, client_isActive, client_createdAt, client_updatedAt,
      deletedChildrenCount,
      ...itemFields
    } = row;

    return {
      ...itemFields,
      User_Item_deletedByIdToUser: deletedBy_id
        ? { id: deletedBy_id, username: deletedBy_username, displayName: deletedBy_displayName }
        : null,
      User_Item_assigneeIdToUser: assignee_id
        ? { id: assignee_id, username: assignee_username, displayName: assignee_displayName }
        : null,
      User_Item_createdByIdToUser: createdBy_id
        ? { id: createdBy_id, username: createdBy_username, displayName: createdBy_displayName }
        : null,
      Client: client_id
        ? {
            id: client_id,
            name: client_name,
            code: client_code,
            description: client_description,
            logoUrl: client_logoUrl,
            isActive: client_isActive,
            createdAt: client_createdAt,
            updatedAt: client_updatedAt,
          }
        : null,
      _count: {
        other_Item: deletedChildrenCount ?? 0,
      },
    };
  });
}

/**
 * Find or create "미정 프로젝트" and "미정 서비스"
 */
async function findOrCreateUndecidedHierarchy(userId: string, projectId?: string) {
  // Find or create "미정 프로젝트"
  let undecidedProject = await queryOne<any>(
    `SELECT * FROM "Item" WHERE "type" = $1 AND "name" LIKE $2 AND "isDeleted" = false LIMIT 1`,
    [ItemType.PROJECT, '%미정%']
  );

  if (!undecidedProject) {
    undecidedProject = await queryOne<any>(
      `INSERT INTO "Item" (
         "id", "name", "type", "status", "progress", "description", "createdById", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        randomUUID(),
        '미정 프로젝트',
        ItemType.PROJECT,
        'NOT_STARTED',
        0,
        '프로젝트가 미정인 항목들을 위한 임시 프로젝트',
        userId,
        new Date(),
      ]
    );
  }

  // Determine which project to use for the undecided service
  const targetProjectId = projectId || undecidedProject!.id;

  // Find or create "미정 서비스" under the target project
  let undecidedService = await queryOne<any>(
    `SELECT * FROM "Item" WHERE "type" = $1 AND "name" LIKE $2 AND "parentId" = $3 AND "isDeleted" = false LIMIT 1`,
    [ItemType.SERVICE, '%미정%', targetProjectId]
  );

  if (!undecidedService) {
    undecidedService = await queryOne<any>(
      `INSERT INTO "Item" (
         "id", "name", "type", "status", "progress", "parentId", "description", "createdById", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        randomUUID(),
        '미정 서비스',
        ItemType.SERVICE,
        'NOT_STARTED',
        0,
        targetProjectId,
        '서비스가 미정인 항목들을 위한 임시 서비스',
        userId,
        new Date(),
      ]
    );
  }

  return { undecidedProject: undecidedProject!, undecidedService: undecidedService! };
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
    await query(
      `UPDATE "Item" SET "parentId" = $1 WHERE id = $2`,
      [undecidedService.id, teamId]
    );
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
  const services = await query<{ id: string }>(
    `SELECT "id" FROM "Item" WHERE "parentId" = $1 AND "type" = $2 AND "isDeleted" = false`,
    [projectId, ItemType.SERVICE]
  );

  // Get all teams under all services
  const allTeamIds: string[] = [];
  let totalActionCount = 0;

  for (const service of services) {
    const teams = await query<{ id: string }>(
      `SELECT "id" FROM "Item" WHERE "parentId" = $1 AND "type" = $2 AND "isDeleted" = false`,
      [service.id, ItemType.TEAM]
    );

    for (const team of teams) {
      allTeamIds.push(team.id);

      const actionCountRow = await queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM "Item"
         WHERE "parentId" = $1 AND "type" = $2 AND "isDeleted" = false`,
        [team.id, ItemType.ACTION]
      );
      totalActionCount += parseInt(actionCountRow?.count ?? '0', 10);
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
  const service = await queryOne<{ id: string; parentId: string | null }>(
    `SELECT "id", "parentId" FROM "Item" WHERE id = $1`,
    [serviceId]
  );

  if (!service) {
    throw new Error('Service not found');
  }

  // Get all teams under the service (with their action counts)
  const teams = await query<{ id: string }>(
    `SELECT "id" FROM "Item" WHERE "parentId" = $1 AND "type" = $2 AND "isDeleted" = false`,
    [serviceId, ItemType.TEAM]
  );

  const teamIds = teams.map(t => t.id);

  let totalActionCount = 0;
  for (const team of teams) {
    const actionCountRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM "Item"
       WHERE "parentId" = $1 AND "type" = $2 AND "isDeleted" = false`,
      [team.id, ItemType.ACTION]
    );
    totalActionCount += parseInt(actionCountRow?.count ?? '0', 10);
  }

  // v1.1.18: Get all ServiceTeams linked to this service
  const serviceTeams = await query<{ id: string }>(
    `SELECT "id" FROM "ServiceTeam" WHERE "serviceId" = $1`,
    [serviceId]
  );

  const serviceTeamIds = serviceTeams.map(st => st.id);

  // v1.1.18: Soft delete all actions linked to these ServiceTeams
  let deletedActionCount = 0;
  if (serviceTeamIds.length > 0) {
    const placeholders = serviceTeamIds.map((_, i) => `$${i + 1}`).join(', ');
    const actionsToDelete = await query<{ id: string }>(
      `SELECT "id" FROM "Item"
       WHERE "serviceTeamId" IN (${placeholders})
         AND "type" = $${serviceTeamIds.length + 1}
         AND "isDeleted" = false`,
      [...serviceTeamIds, ItemType.ACTION]
    );

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
