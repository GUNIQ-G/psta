import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne, transaction } from '../config/database';
import { ItemType, ItemStatus } from '../types/enums';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { updateItemAndParents } from '../services/item-calculation.service';
import appLogger, { errorLogger } from '../config/logger';
import {
  softDeleteItem,
  softDeleteProjectWithTeamPreservation,
  softDeleteServiceWithTeamPreservation,
} from '../services/soft-delete.service';
import { NotificationService } from '../services/notification.service';
import { extractDescriptionMentionIds, sendDescriptionMentionNotifications } from '../services/mention.service';
import { UPLOADS_DIR } from '../config/paths';

export const getItems = async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, type, parentId, assigneeId } = req.query;

    const conditions: string[] = ['"Item"."isDeleted" = false'];
    const params: any[] = [];
    let paramIdx = 1;

    if (clientId) {
      conditions.push(`"Item"."clientId" = $${paramIdx++}`);
      params.push(clientId as string);
    }
    if (type) {
      conditions.push(`"Item"."type" = $${paramIdx++}`);
      params.push(type as string);
    }
    if (assigneeId) {
      conditions.push(`"Item"."assigneeId" = $${paramIdx++}`);
      params.push(assigneeId as string);
    }
    if (parentId === 'null' || parentId === '') {
      conditions.push(`"Item"."parentId" IS NULL`);
    } else if (parentId) {
      conditions.push(`"Item"."parentId" = $${paramIdx++}`);
      params.push(parentId as string);
    }

    const whereClause = conditions.join(' AND ');

    const items = await query<any>(
      `SELECT "Item".*,
        row_to_json("C".*) AS "Client",
        row_to_json("PA".*) AS "Item",
        json_build_object('id', "AU"."id", 'username', "AU"."username", 'displayName', "AU"."displayName", 'email', "AU"."email") AS "User_Item_assigneeIdToUser"
       FROM "Item"
       LEFT JOIN "Client" "C" ON "C"."id" = "Item"."clientId"
       LEFT JOIN "Item" "PA" ON "PA"."id" = "Item"."parentId"
       LEFT JOIN "User" "AU" ON "AU"."id" = "Item"."assigneeId"
       WHERE ${whereClause}
       ORDER BY "Item"."order" ASC`,
      params
    );

    // Fetch children (other_Item) for each item
    for (const item of items) {
      let childrenQuery: string;
      let childrenParams: any[];

      if (type === ItemType.SERVICE) {
        // For SERVICE: include child ACTIONs with creator team info
        childrenQuery = `
          SELECT ci.*,
            json_build_object('id', "AU"."id", 'username', "AU"."username", 'displayName', "AU"."displayName") AS "User_Item_assigneeIdToUser",
            json_build_object(
              'id', "CU"."id", 'username', "CU"."username", 'displayName', "CU"."displayName",
              'teamId', "CU"."teamId",
              'Team', CASE WHEN "T"."id" IS NOT NULL THEN json_build_object('id', "T"."id", 'name', "T"."name", 'level', "T"."level") ELSE NULL END
            ) AS "User_Item_createdByIdToUser"
          FROM "Item" ci
          LEFT JOIN "User" "AU" ON "AU"."id" = ci."assigneeId"
          LEFT JOIN "User" "CU" ON "CU"."id" = ci."createdById"
          LEFT JOIN "Team" "T" ON "T"."id" = "CU"."teamId"
          WHERE ci."parentId" = $1 AND ci."isDeleted" = false AND ci."type" = $2
          ORDER BY ci."order" ASC`;
        childrenParams = [item.id, ItemType.ACTION];
      } else {
        childrenQuery = `
          SELECT ci.*,
            json_build_object('id', "AU"."id", 'username', "AU"."username", 'displayName', "AU"."displayName") AS "User_Item_assigneeIdToUser"
          FROM "Item" ci
          LEFT JOIN "User" "AU" ON "AU"."id" = ci."assigneeId"
          WHERE ci."parentId" = $1 AND ci."isDeleted" = false
          ORDER BY ci."order" ASC`;
        childrenParams = [item.id];
      }

      item.other_Item = await query<any>(childrenQuery, childrenParams);

      // For ACTION type: also include parent item hierarchy and creator team info and _count
      if (type === ItemType.ACTION) {
        // Parent service with its parent (project)
        if (item.parentId) {
          const parentService = await queryOne<any>(
            `SELECT s."id", s."name", s."parentId",
               CASE WHEN p."id" IS NOT NULL THEN json_build_object('id', p."id", 'name', p."name") ELSE NULL END AS "Item"
             FROM "Item" s
             LEFT JOIN "Item" p ON p."id" = s."parentId"
             WHERE s."id" = $1`,
            [item.parentId]
          );
          item.Item = parentService;
        }

        // Creator with team info
        if (item.createdById) {
          const creator = await queryOne<any>(
            `SELECT u."id", u."username", u."displayName", u."teamId",
               CASE WHEN t."id" IS NOT NULL THEN json_build_object('id', t."id", 'name', t."name") ELSE NULL END AS "Team"
             FROM "User" u
             LEFT JOIN "Team" t ON t."id" = u."teamId"
             WHERE u."id" = $1`,
            [item.createdById]
          );
          item.User_Item_createdByIdToUser = creator;
        }

        // Counts
        const [commentCount, fileCount, linkCount] = await Promise.all([
          queryOne<any>(`SELECT COUNT(*) as count FROM "Comment" WHERE "itemId" = $1`, [item.id]),
          queryOne<any>(`SELECT COUNT(*) as count FROM "File" WHERE "itemId" = $1`, [item.id]),
          queryOne<any>(`SELECT COUNT(*) as count FROM "Link" WHERE "itemId" = $1`, [item.id]),
        ]);
        item._count = {
          Comment: parseInt(commentCount?.count ?? '0'),
          File: parseInt(fileCount?.count ?? '0'),
          Link: parseInt(linkCount?.count ?? '0'),
        };
      }
    }

    res.json(items);
  } catch (error: any) {
    errorLogger.error('Failed to get items', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getItemById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const item = await queryOne<any>(
      `SELECT "Item".*,
        row_to_json("C".*) AS "Client",
        row_to_json("PA".*) AS "Item",
        json_build_object('id', "AU"."id", 'username', "AU"."username", 'displayName', "AU"."displayName", 'email', "AU"."email") AS "User_Item_assigneeIdToUser",
        json_build_object(
          'id', "CU"."id", 'username', "CU"."username", 'displayName', "CU"."displayName",
          'teamId', "CU"."teamId",
          'Team', CASE WHEN "CT"."id" IS NOT NULL THEN json_build_object('id', "CT"."id", 'name', "CT"."name") ELSE NULL END
        ) AS "User_Item_createdByIdToUser"
       FROM "Item"
       LEFT JOIN "Client" "C" ON "C"."id" = "Item"."clientId"
       LEFT JOIN "Item" "PA" ON "PA"."id" = "Item"."parentId"
       LEFT JOIN "User" "AU" ON "AU"."id" = "Item"."assigneeId"
       LEFT JOIN "User" "CU" ON "CU"."id" = "Item"."createdById"
       LEFT JOIN "Team" "CT" ON "CT"."id" = "CU"."teamId"
       WHERE "Item"."id" = $1`,
      [id]
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // other_Item: children with assignee and creator team info
    item.other_Item = await query<any>(
      `SELECT ci.*,
         json_build_object('id', "AU"."id", 'username', "AU"."username", 'displayName', "AU"."displayName") AS "User_Item_assigneeIdToUser",
         json_build_object(
           'id', "CU"."id", 'username', "CU"."username", 'displayName', "CU"."displayName",
           'teamId', "CU"."teamId",
           'Team', CASE WHEN "T"."id" IS NOT NULL THEN json_build_object('id', "T"."id", 'name', "T"."name") ELSE NULL END
         ) AS "User_Item_createdByIdToUser"
       FROM "Item" ci
       LEFT JOIN "User" "AU" ON "AU"."id" = ci."assigneeId"
       LEFT JOIN "User" "CU" ON "CU"."id" = ci."createdById"
       LEFT JOIN "Team" "T" ON "T"."id" = "CU"."teamId"
       WHERE ci."parentId" = $1 AND ci."isDeleted" = false
       ORDER BY ci."order" ASC`,
      [id]
    );

    // ServiceTeamsAsService: ServiceTeam rows where serviceId = item.id
    item.ServiceTeamsAsService = await query<any>(
      `SELECT st.*, row_to_json("T".*) AS "Team"
       FROM "ServiceTeam" st
       LEFT JOIN "Team" "T" ON "T"."id" = st."teamId"
       WHERE st."serviceId" = $1`,
      [id]
    );

    // ServiceTeam: ServiceTeam rows where this item is an ACTION (via serviceTeamId)
    item.ServiceTeam = await query<any>(
      `SELECT st.*,
         row_to_json("T".*) AS "Team",
         json_build_object(
           'id', s."id", 'name', s."name", 'parentId', s."parentId",
           'Item', CASE WHEN p."id" IS NOT NULL THEN json_build_object('id', p."id", 'name', p."name") ELSE NULL END
         ) AS "Service"
       FROM "ServiceTeam" st
       LEFT JOIN "Team" "T" ON "T"."id" = st."teamId"
       LEFT JOIN "Item" s ON s."id" = st."serviceId"
       LEFT JOIN "Item" p ON p."id" = s."parentId"
       WHERE st."id" = $1`,
      [item.serviceTeamId]
    );

    // WorkRequest: work requests for this item
    item.WorkRequest = await query<any>(
      `SELECT wr.*,
         json_build_object('id', "RQ"."id", 'username', "RQ"."username", 'displayName', "RQ"."displayName", 'email', "RQ"."email") AS "Requester",
         json_build_object('id', "AQ"."id", 'username', "AQ"."username", 'displayName', "AQ"."displayName", 'email', "AQ"."email") AS "Assignee"
       FROM "WorkRequest" wr
       LEFT JOIN "User" "RQ" ON "RQ"."id" = wr."requesterId"
       LEFT JOIN "User" "AQ" ON "AQ"."id" = wr."assigneeId"
       WHERE wr."itemId" = $1`,
      [id]
    );

    res.json(item);
  } catch (error: any) {
    errorLogger.error('Failed to get item by id', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createItem = async (req: AuthRequest, res: Response) => {
  try {
    const {
      type,
      name,
      status,
      progress,
      startDate,
      endDate,
      clientId,
      parentId,
      serviceTeamId,
      assigneeId,
      description,
    } = req.body;

    // 상세 로그: 액션 생성 요청 정보
    if (type === ItemType.ACTION) {
      appLogger.info('🔍 ACTION creation request received', {
        name,
        type,
        serviceTeamId,
        parentId,
        clientId,
        assigneeId,
        userId: req.user!.id,
        username: req.user!.username,
        requestBody: req.body,
      });
    }

    if (!type || !name) {
      return res.status(400).json({ error: 'Type and name are required' });
    }

    // 3단계 구조: 프로젝트 → 서비스 → 액션
    let finalParentId = parentId;
    if (type === ItemType.ACTION) {
      if (parentId) {
        const service = await queryOne<any>(
          `SELECT "id", "name", "type" FROM "Item" WHERE "id" = $1`,
          [parentId]
        );

        if (!service || service.type !== ItemType.SERVICE) {
          return res.status(400).json({ error: 'parentId must be a valid SERVICE for ACTION type' });
        }

        finalParentId = parentId;
        appLogger.info('✅ ACTION parentId set to SERVICE (direct)', {
          actionName: name,
          serviceId: parentId,
          serviceName: service.name,
        });
      } else if (serviceTeamId) {
        const serviceTeam = await queryOne<any>(
          `SELECT st.*, row_to_json("T".*) AS "Team", row_to_json(s.*) AS "Service"
           FROM "ServiceTeam" st
           LEFT JOIN "Team" "T" ON "T"."id" = st."teamId"
           LEFT JOIN "Item" s ON s."id" = st."serviceId"
           WHERE st."id" = $1`,
          [serviceTeamId]
        );

        if (!serviceTeam) {
          return res.status(400).json({ error: 'Invalid serviceTeamId' });
        }

        finalParentId = serviceTeam.serviceId;
        appLogger.info('✅ ACTION parentId set to SERVICE (via serviceTeamId)', {
          actionName: name,
          serviceId: serviceTeam.serviceId,
          serviceName: serviceTeam.Service?.name,
          teamName: serviceTeam.Team?.name,
          serviceTeamId,
        });
      } else {
        return res.status(400).json({ error: 'parentId (serviceId) is required for ACTION type' });
      }
    }

    // 상태-진행률 자동 연동
    let finalStatus = status || ItemStatus.NOT_STARTED;
    let finalProgress = progress ?? 0;

    if (status === ItemStatus.NOT_STARTED && (progress === undefined || progress === null)) {
      finalProgress = 0;
    } else if (status === ItemStatus.COMPLETED && (progress === undefined || progress === null)) {
      finalProgress = 100;
    } else if (progress === 0 && !status) {
      finalStatus = ItemStatus.NOT_STARTED;
    } else if (progress === 100 && !status) {
      finalStatus = ItemStatus.COMPLETED;
    } else if (progress !== undefined && progress > 0 && progress < 100 && !status) {
      finalStatus = ItemStatus.IN_PROGRESS;
    }

    const newId = randomUUID();
    const now = new Date();

    const item = await queryOne<any>(
      `INSERT INTO "Item" ("id", "type", "name", "status", "progress", "startDate", "endDate", "clientId", "parentId", "serviceTeamId", "assigneeId", "description", "createdById", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        newId,
        type,
        name,
        finalStatus,
        finalProgress,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        clientId ?? null,
        finalParentId ?? null,
        serviceTeamId ?? null,
        assigneeId ?? null,
        description ?? null,
        req.user!.id,
        now,
      ]
    );

    // Attach Client and assignee info to response
    if (item) {
      if (item.clientId) {
        item.Client = await queryOne<any>(`SELECT * FROM "Client" WHERE "id" = $1`, [item.clientId]);
      } else {
        item.Client = null;
      }
      if (item.assigneeId) {
        item.User_Item_assigneeIdToUser = await queryOne<any>(
          `SELECT "id", "username", "displayName" FROM "User" WHERE "id" = $1`,
          [item.assigneeId]
        );
      } else {
        item.User_Item_assigneeIdToUser = null;
      }
    }

    // 🔔 업무 할당 알림: 담당자가 지정된 경우 (본인 제외)
    if (assigneeId && assigneeId !== req.user!.id) {
      try {
        await NotificationService.notifyItemAssigned({
          itemId: item.id,
          itemName: item.name,
          assigneeId,
          assignedById: req.user!.id,
        });
      } catch (notifyError: any) {
        appLogger.warn('Failed to send item assigned notification', {
          itemId: item.id,
          error: notifyError.message,
        });
      }
    }

    // 🔔 description 멘션 알림
    if (description) {
      try {
        const mentionIds = extractDescriptionMentionIds(description);
        if (mentionIds.length > 0) {
          await sendDescriptionMentionNotifications(item.id, item.name, req.user!.id, mentionIds, []);
        }
      } catch (notifyError: any) {
        appLogger.warn('Failed to send description mention notification', { itemId: item.id, error: notifyError.message });
      }
    }

    // If item has a parent, update parent chain
    if (parentId) {
      await updateItemAndParents(parentId);
    }

    // If creating a PROJECT, automatically create "미정 서비스" under it
    if (type === ItemType.PROJECT) {
      await queryOne<any>(
        `INSERT INTO "Item" ("id", "name", "type", "status", "progress", "parentId", "description", "createdById", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          randomUUID(),
          '미정 서비스',
          ItemType.SERVICE,
          ItemStatus.NOT_STARTED,
          0,
          item.id,
          '서비스가 미정인 항목들을 위한 임시 서비스',
          req.user!.id,
          new Date(),
        ]
      );
      appLogger.info('Auto-created "미정 서비스" for new project', {
        projectId: item.id,
        projectName: item.name,
        createdBy: req.user!.id,
      });
    }

    // 상세 로그: 액션 생성 완료
    if (type === ItemType.ACTION) {
      appLogger.info('✅ ACTION created successfully', {
        itemId: item.id,
        name: item.name,
        serviceTeamId: item.serviceTeamId,
        parentId: item.parentId,
        clientId: item.clientId,
      });

      // 🔔 미정 액션 알림
      if (serviceTeamId) {
        try {
          const serviceTeamForNotify = await queryOne<any>(
            `SELECT st.*, row_to_json(s.*) AS "Service", row_to_json("T".*) AS "Team"
             FROM "ServiceTeam" st
             LEFT JOIN "Item" s ON s."id" = st."serviceId"
             LEFT JOIN "Team" "T" ON "T"."id" = st."teamId"
             WHERE st."id" = $1`,
            [serviceTeamId]
          );

          if (serviceTeamForNotify?.Service) {
            const projectItem = serviceTeamForNotify.Service.parentId
              ? await queryOne<any>(`SELECT * FROM "Item" WHERE "id" = $1`, [serviceTeamForNotify.Service.parentId])
              : null;

            const isProjectUndecided = projectItem?.name.includes('미정') || false;
            const isServiceUndecided = serviceTeamForNotify.Service.name.includes('미정');

            if (isProjectUndecided || isServiceUndecided) {
              await NotificationService.notifyUndecidedActionCreated({
                actionId: item.id,
                actionName: item.name,
                isProjectUndecided,
                isServiceUndecided,
                createdById: req.user!.id,
                teamId: serviceTeamForNotify.teamId,
              });

              appLogger.info('🔔 Undecided action notification sent', {
                actionId: item.id,
                actionName: item.name,
                isProjectUndecided,
                isServiceUndecided,
                teamId: serviceTeamForNotify.teamId,
              });
            }
          }
        } catch (notifyError: any) {
          appLogger.warn('⚠️ Failed to send undecided action notification', {
            actionId: item.id,
            error: notifyError.message,
          });
        }
      }
    }

    res.status(201).json(item);
  } catch (error: any) {
    errorLogger.error('❌ Error creating item', {
      error,
      stack: error.stack,
      requestBody: req.body,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const existingItem = await queryOne<any>(`SELECT * FROM "Item" WHERE "id" = $1`, [id]);
    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Check permissions: only creator or ADMIN can update
    const currentUser = req.user!;
    if (currentUser.role !== 'ADMIN' && existingItem.createdById !== currentUser.id) {
      return res.status(403).json({ error: '생성자 또는 최고관리자만 수정할 수 있습니다' });
    }

    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);
    updateData.updatedAt = new Date();

    // 상태-진행률 자동 연동 (ACTION 타입에만 적용)
    if (existingItem.type === ItemType.ACTION) {
      const statusChanged = updateData.status !== undefined && updateData.status !== existingItem.status;
      const progressChanged = updateData.progress !== undefined && updateData.progress !== existingItem.progress;

      if (statusChanged && !progressChanged) {
        if (updateData.status === ItemStatus.NOT_STARTED) {
          updateData.progress = 0;
        } else if (updateData.status === ItemStatus.COMPLETED) {
          updateData.progress = 100;
        }
      } else if (progressChanged && !statusChanged) {
        if (updateData.progress === 0) {
          updateData.status = ItemStatus.NOT_STARTED;
        } else if (updateData.progress === 100) {
          updateData.status = ItemStatus.COMPLETED;
        } else if (updateData.progress > 0 && updateData.progress < 100) {
          if (existingItem.status !== ItemStatus.ON_HOLD) {
            updateData.status = ItemStatus.IN_PROGRESS;
          }
        }
      }
    }

    // ACTION: parentId 또는 serviceTeamId 변경 시 처리
    if (existingItem.type === ItemType.ACTION) {
      if (updateData.parentId && updateData.parentId !== existingItem.parentId) {
        const service = await queryOne<any>(
          `SELECT "id", "name", "type" FROM "Item" WHERE "id" = $1`,
          [updateData.parentId]
        );

        if (service && service.type === ItemType.SERVICE) {
          appLogger.info('✅ ACTION parentId updated directly', {
            actionId: id,
            newParentId: updateData.parentId,
            serviceName: service.name,
          });
        }
      } else if (updateData.serviceTeamId && updateData.serviceTeamId !== existingItem.serviceTeamId) {
        const newServiceTeam = await queryOne<any>(
          `SELECT "serviceId" FROM "ServiceTeam" WHERE "id" = $1`,
          [updateData.serviceTeamId]
        );

        if (newServiceTeam) {
          updateData.parentId = newServiceTeam.serviceId;
          appLogger.info('✅ ACTION parentId updated via serviceTeamId', {
            actionId: id,
            newServiceTeamId: updateData.serviceTeamId,
            newParentId: newServiceTeam.serviceId,
          });
        }
      }
    }

    // Build dynamic SET clause
    const allowedFields = [
      'type', 'name', 'status', 'progress', 'startDate', 'endDate',
      'clientId', 'parentId', 'serviceTeamId', 'assigneeId', 'description',
      'order', 'isOnHold', 'updatedAt',
    ];
    const setClauses: string[] = [];
    const setParams: any[] = [];
    let paramIdx = 1;

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        setClauses.push(`"${field}" = $${paramIdx++}`);
        setParams.push(updateData[field]);
      }
    }

    if (setClauses.length === 0) {
      return res.json(existingItem);
    }

    setParams.push(id);
    const item = await queryOne<any>(
      `UPDATE "Item" SET ${setClauses.join(', ')} WHERE "id" = $${paramIdx} RETURNING *`,
      setParams
    );

    // Attach Client and assignee info
    if (item) {
      if (item.clientId) {
        item.Client = await queryOne<any>(`SELECT * FROM "Client" WHERE "id" = $1`, [item.clientId]);
      } else {
        item.Client = null;
      }
      if (item.assigneeId) {
        item.User_Item_assigneeIdToUser = await queryOne<any>(
          `SELECT "id", "username", "displayName" FROM "User" WHERE "id" = $1`,
          [item.assigneeId]
        );
      } else {
        item.User_Item_assigneeIdToUser = null;
      }
    }

    // 🔔 상태 변경/완료 알림
    if (updateData.status && updateData.status !== existingItem.status) {
      try {
        if (existingItem.assigneeId && existingItem.assigneeId !== req.user!.id) {
          await NotificationService.notifyStatusChanged({
            itemId: item.id,
            itemName: item.name,
            oldStatus: existingItem.status,
            newStatus: updateData.status,
            assigneeId: existingItem.assigneeId,
            changedById: req.user!.id,
          });
        }

        if (updateData.status === ItemStatus.COMPLETED && existingItem.createdById !== req.user!.id) {
          await NotificationService.notifyItemCompleted({
            itemId: item.id,
            itemName: item.name,
            completedById: req.user!.id,
            notifyUserIds: [existingItem.createdById],
          });
        }
      } catch (notifyError: any) {
        appLogger.warn('Failed to send status change notification', {
          itemId: item.id,
          error: notifyError.message,
        });
      }
    }

    // 🔔 description 멘션 diff 알림
    if (updateData.description !== undefined) {
      try {
        const oldMentionIds = extractDescriptionMentionIds(existingItem.description);
        const newMentionIds = extractDescriptionMentionIds(updateData.description);
        const addedIds = newMentionIds.filter((mid: string) => !oldMentionIds.includes(mid));
        const keptIds = newMentionIds.filter((mid: string) => oldMentionIds.includes(mid));
        if (addedIds.length > 0 || keptIds.length > 0) {
          await sendDescriptionMentionNotifications(item.id, item.name, req.user!.id, addedIds, keptIds);
        }
      } catch (notifyError: any) {
        appLogger.warn('Failed to send description mention notification on update', { itemId: item.id, error: notifyError.message });
      }
    }

    if (existingItem.parentId && (
      updateData.status !== undefined ||
      updateData.progress !== undefined ||
      updateData.isOnHold !== undefined
    )) {
      await updateItemAndParents(existingItem.parentId);
    }

    res.json(item);
  } catch (error: any) {
    errorLogger.error('Failed to update item', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingItem = await queryOne<any>(`SELECT * FROM "Item" WHERE "id" = $1`, [id]);
    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (existingItem.isDeleted) {
      return res.status(400).json({ error: 'Item is already deleted' });
    }

    const currentUser = req.user!;
    if (currentUser.role !== 'ADMIN' && existingItem.createdById !== currentUser.id) {
      return res.status(403).json({ error: '생성자 또는 최고관리자만 삭제할 수 있습니다' });
    }

    let result;
    if (existingItem.type === ItemType.PROJECT) {
      result = await softDeleteProjectWithTeamPreservation(id, currentUser.id);

      appLogger.info('Project soft deleted with team preservation', {
        itemId: id,
        itemName: existingItem.name,
        deletedCount: result.deletedCount,
        movedTeamCount: result.movedTeamCount,
        actionCount: result.actionCount,
        deletedBy: currentUser.id,
      });

      return res.status(200).json({
        message: '삭제되었습니다',
        deletedCount: result.deletedCount,
        movedTeamCount: result.movedTeamCount,
        actionCount: result.actionCount,
      });
    } else if (existingItem.type === ItemType.SERVICE) {
      result = await softDeleteServiceWithTeamPreservation(id, currentUser.id);

      appLogger.info('Service soft deleted with team preservation', {
        itemId: id,
        itemName: existingItem.name,
        deletedCount: result.deletedCount,
        movedTeamCount: result.movedTeamCount,
        actionCount: result.actionCount,
        deletedBy: currentUser.id,
      });

      return res.status(200).json({
        message: '삭제되었습니다',
        deletedCount: result.deletedCount,
        movedTeamCount: result.movedTeamCount,
        actionCount: result.actionCount,
      });
    } else {
      result = await softDeleteItem(id, {
        userId: currentUser.id,
        recursive: true,
      });

      appLogger.info('Items soft deleted', {
        itemId: id,
        itemName: existingItem.name,
        deletedCount: result.deletedCount,
        deletedBy: currentUser.id,
      });

      return res.status(200).json({
        message: '삭제되었습니다',
        deletedCount: result.deletedCount,
      });
    }
  } catch (error: any) {
    errorLogger.error('Failed to delete item', {
      itemId: req.params.id,
      error,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getItemTree = async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, userTeamId } = req.query;

    const buildTree = async (items: any[], parentClient?: any): Promise<any[]> => {
      return Promise.all(
        items.map(async (item) => {
          const [commentRow, fileRow, linkRow] = await Promise.all([
            queryOne<any>(`SELECT COUNT(*) as count FROM "Comment" WHERE "itemId" = $1`, [item.id]),
            queryOne<any>(`SELECT COUNT(*) as count FROM "File" WHERE "itemId" = $1`, [item.id]),
            queryOne<any>(`SELECT COUNT(*) as count FROM "Link" WHERE "itemId" = $1`, [item.id]),
          ]);
          const commentCount = parseInt(commentRow?.count ?? '0');
          const fileCount = parseInt(fileRow?.count ?? '0');
          const linkCount = parseInt(linkRow?.count ?? '0');

          let children: any[] = [];

          if (item.type === ItemType.TEAM) {
            // Find ServiceTeam matching this TEAM item
            const serviceTeam = await queryOne<any>(
              `SELECT st.* FROM "ServiceTeam" st
               INNER JOIN "Team" "T" ON "T"."id" = st."teamId"
               WHERE st."serviceId" = $1 AND "T"."name" = $2
               LIMIT 1`,
              [item.parentId, item.name]
            );

            if (serviceTeam) {
              children = await query<any>(
                `SELECT ci.*,
                   json_build_object('id', "AU"."id", 'username', "AU"."username", 'displayName', "AU"."displayName") AS "User_Item_assigneeIdToUser",
                   json_build_object(
                     'id', "CU"."id", 'username', "CU"."username", 'displayName', "CU"."displayName",
                     'teamId', "CU"."teamId",
                     'Team', CASE WHEN "T"."id" IS NOT NULL THEN json_build_object('id', "T"."id", 'name', "T"."name") ELSE NULL END
                   ) AS "User_Item_createdByIdToUser",
                   json_build_object(
                     'id', ps."id", 'name', ps."name", 'parentId', ps."parentId",
                     'Item', CASE WHEN pp."id" IS NOT NULL THEN json_build_object('id', pp."id", 'name', pp."name") ELSE NULL END
                   ) AS "Item",
                   row_to_json("C".*) AS "Client"
                 FROM "Item" ci
                 LEFT JOIN "User" "AU" ON "AU"."id" = ci."assigneeId"
                 LEFT JOIN "User" "CU" ON "CU"."id" = ci."createdById"
                 LEFT JOIN "Team" "T" ON "T"."id" = "CU"."teamId"
                 LEFT JOIN "Item" ps ON ps."id" = ci."parentId"
                 LEFT JOIN "Item" pp ON pp."id" = ps."parentId"
                 LEFT JOIN "Client" "C" ON "C"."id" = ci."clientId"
                 WHERE ci."type" = $1 AND ci."serviceTeamId" = $2 AND ci."isDeleted" = false
                 ORDER BY ci."order" ASC`,
                [ItemType.ACTION, serviceTeam.id]
              );

              if (children.length > 0) {
                appLogger.info('📋 Found ACTIONs for TEAM', {
                  teamId: item.id,
                  teamName: item.name,
                  serviceId: item.parentId,
                  serviceTeamId: serviceTeam.id,
                  actionCount: children.length,
                  actionDates: children.map((c: any) => ({
                    name: c.name,
                    startDate: c.startDate,
                    endDate: c.endDate,
                  })),
                });
              }
            }
          } else {
            children = await query<any>(
              `SELECT ci.*,
                 json_build_object('id', "AU"."id", 'username', "AU"."username", 'displayName', "AU"."displayName") AS "User_Item_assigneeIdToUser",
                 json_build_object(
                   'id', "CU"."id", 'username', "CU"."username", 'displayName', "CU"."displayName",
                   'teamId', "CU"."teamId",
                   'Team', CASE WHEN "T"."id" IS NOT NULL THEN json_build_object('id', "T"."id", 'name', "T"."name") ELSE NULL END
                 ) AS "User_Item_createdByIdToUser",
                 json_build_object(
                   'id', ps."id", 'name', ps."name", 'parentId', ps."parentId",
                   'Item', CASE WHEN pp."id" IS NOT NULL THEN json_build_object('id', pp."id", 'name', pp."name") ELSE NULL END
                 ) AS "Item",
                 row_to_json("C".*) AS "Client"
               FROM "Item" ci
               LEFT JOIN "User" "AU" ON "AU"."id" = ci."assigneeId"
               LEFT JOIN "User" "CU" ON "CU"."id" = ci."createdById"
               LEFT JOIN "Team" "T" ON "T"."id" = "CU"."teamId"
               LEFT JOIN "Item" ps ON ps."id" = ci."parentId"
               LEFT JOIN "Item" pp ON pp."id" = ps."parentId"
               LEFT JOIN "Client" "C" ON "C"."id" = ci."clientId"
               WHERE ci."parentId" = $1 AND ci."isDeleted" = false
               ORDER BY ci."order" ASC`,
              [item.id]
            );
          }

          // ACTION 타입 자식들을 팀 이름 기준 가나다순으로 정렬
          if (children.length > 0 && children.some((c: any) => c.type === ItemType.ACTION)) {
            children.sort((a: any, b: any) => {
              if (a.type === ItemType.ACTION && b.type === ItemType.ACTION) {
                const teamA = a.User_Item_createdByIdToUser?.Team?.name || '';
                const teamB = b.User_Item_createdByIdToUser?.Team?.name || '';
                return teamA.localeCompare(teamB, 'ko');
              }
              return (a.order || 0) - (b.order || 0);
            });
          }

          const effectiveClient = item.Client || parentClient;
          const processedChildren = children.length > 0 ? await buildTree(children, effectiveClient) : [];

          let calculatedStartDate = item.startDate;
          let calculatedEndDate = item.endDate;

          if (item.type === ItemType.TEAM) {
            appLogger.info('🔍 Processing TEAM item', {
              teamId: item.id,
              teamName: item.name,
              processedChildrenCount: processedChildren.length,
              hasOriginalDates: !!(item.startDate || item.endDate),
            });
          }

          if (item.type === ItemType.TEAM && processedChildren.length > 0) {
            const datesFromChildren = processedChildren
              .filter((child: any) => child.startDate || child.endDate)
              .map((child: any) => ({
                startDate: child.startDate ? new Date(child.startDate) : null,
                endDate: child.endDate ? new Date(child.endDate) : null,
              }));

            if (datesFromChildren.length > 0) {
              const startDates = datesFromChildren
                .map((d: any) => d.startDate)
                .filter((d: Date | null): d is Date => d !== null);

              if (startDates.length > 0) {
                calculatedStartDate = new Date(Math.min(...startDates.map((d: Date) => d.getTime())));
              }

              const endDates = datesFromChildren
                .map((d: any) => d.endDate)
                .filter((d: Date | null): d is Date => d !== null);

              if (endDates.length > 0) {
                calculatedEndDate = new Date(Math.max(...endDates.map((d: Date) => d.getTime())));
              }

              appLogger.info('📅 Auto-calculated TEAM dates', {
                teamId: item.id,
                teamName: item.name,
                childrenCount: processedChildren.length,
                datesFound: datesFromChildren.length,
                calculatedStartDate: calculatedStartDate?.toISOString(),
                calculatedEndDate: calculatedEndDate?.toISOString(),
              });
            }
          }

          return {
            ...item,
            startDate: calculatedStartDate,
            endDate: calculatedEndDate,
            Client: effectiveClient,
            _count: {
              Comment: commentCount,
              File: fileCount,
              Link: linkCount,
            },
            children: processedChildren,
          };
        })
      );
    };

    // If userTeamId is provided, filter to show only items related to user's team
    if (userTeamId) {
      const userTeam = await queryOne<any>(`SELECT * FROM "Team" WHERE "id" = $1`, [userTeamId as string]);

      if (!userTeam) {
        return res.json([]);
      }

      const serviceTeams = await query<any>(
        `SELECT st.*, json_build_object('id', s."id", 'parentId', s."parentId", 'isDeleted', s."isDeleted") AS "Service"
         FROM "ServiceTeam" st
         INNER JOIN "Item" s ON s."id" = st."serviceId"
         WHERE st."teamId" = $1 AND s."isDeleted" = false`,
        [userTeam.id]
      );

      const projectIds = new Set<string>();
      serviceTeams.forEach((st: any) => {
        if (st.Service.parentId) {
          projectIds.add(st.Service.parentId);
        }
      });

      const projectIdsArray = Array.from(projectIds);
      if (projectIdsArray.length === 0) {
        return res.json([]);
      }

      const placeholders = projectIdsArray.map((_: any, i: number) => `$${i + 1}`).join(', ');
      const projects = await query<any>(
        `SELECT i.*,
           row_to_json("C".*) AS "Client",
           json_build_object('id', "AU"."id", 'username', "AU"."username", 'displayName', "AU"."displayName") AS "User_Item_assigneeIdToUser",
           json_build_object('Comment', (SELECT COUNT(*) FROM "Comment" WHERE "itemId" = i."id")) AS "_count"
         FROM "Item" i
         LEFT JOIN "Client" "C" ON "C"."id" = i."clientId"
         LEFT JOIN "User" "AU" ON "AU"."id" = i."assigneeId"
         WHERE i."id" IN (${placeholders}) AND i."type" = $${projectIdsArray.length + 1} AND i."parentId" IS NULL AND i."isDeleted" = false
         ORDER BY i."order" ASC`,
        [...projectIdsArray, ItemType.PROJECT]
      );

      const serviceIdsWithUserTeam = new Set(serviceTeams.map((st: any) => st.serviceId));
      const filteredTree = await Promise.all(
        projects.map(async (project: any) => {
          const allServices = await query<any>(
            `SELECT i.*,
               row_to_json("C".*) AS "Client",
               json_build_object('id', "AU"."id", 'username', "AU"."username", 'displayName', "AU"."displayName") AS "User_Item_assigneeIdToUser",
               json_build_object('Comment', (SELECT COUNT(*) FROM "Comment" WHERE "itemId" = i."id")) AS "_count"
             FROM "Item" i
             LEFT JOIN "Client" "C" ON "C"."id" = i."clientId"
             LEFT JOIN "User" "AU" ON "AU"."id" = i."assigneeId"
             WHERE i."parentId" = $1 AND i."isDeleted" = false
             ORDER BY i."order" ASC`,
            [project.id]
          );

          const servicesWithUserTeam = [];
          for (const service of allServices) {
            if (serviceIdsWithUserTeam.has(service.id)) {
              const serviceWithTree = {
                ...service,
                Client: service.Client || project.Client,
                children: await buildTree([service], project.Client).then((built: any[]) => built[0]?.children || []),
              };
              servicesWithUserTeam.push(serviceWithTree);
            }
          }

          return {
            ...project,
            children: servicesWithUserTeam,
          };
        })
      );

      return res.json(filteredTree);
    }

    // Default behavior: show all items (only PROJECT at root level)
    const rootConditions = [
      `"parentId" IS NULL`,
      `"type" = $1`,
      `"isDeleted" = false`,
    ];
    const rootParams: any[] = [ItemType.PROJECT];
    let rootParamIdx = 2;

    if (clientId) {
      rootConditions.push(`"clientId" = $${rootParamIdx++}`);
      rootParams.push(clientId as string);
    }

    const rootItems = await query<any>(
      `SELECT i.*,
         row_to_json("C".*) AS "Client",
         json_build_object('id', "AU"."id", 'username', "AU"."username", 'displayName', "AU"."displayName") AS "User_Item_assigneeIdToUser",
         json_build_object('Comment', (SELECT COUNT(*) FROM "Comment" WHERE "itemId" = i."id")) AS "_count"
       FROM "Item" i
       LEFT JOIN "Client" "C" ON "C"."id" = i."clientId"
       LEFT JOIN "User" "AU" ON "AU"."id" = i."assigneeId"
       WHERE ${rootConditions.join(' AND ')}
       ORDER BY i."order" ASC`,
      rootParams
    );

    const tree = await buildTree(rootItems);
    res.json(tree);
  } catch (error: any) {
    errorLogger.error('Failed to get item tree', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const moveItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { parentId, serviceTeamId } = req.body;

    const item = await queryOne<any>(
      `SELECT i.*,
         row_to_json(pi.*) AS "Item",
         row_to_json(st.*) AS "ServiceTeam"
       FROM "Item" i
       LEFT JOIN "Item" pi ON pi."id" = i."parentId"
       LEFT JOIN "ServiceTeam" st ON st."id" = i."serviceTeamId"
       WHERE i."id" = $1`,
      [id]
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // ACTION 타입인 경우 serviceTeamId로 이동
    if (item.type === ItemType.ACTION) {
      if (!serviceTeamId) {
        return res.status(400).json({ error: 'serviceTeamId is required for ACTION type' });
      }

      const newServiceTeam = await queryOne<any>(
        `SELECT st.*, row_to_json(s.*) AS "Service", row_to_json("T".*) AS "Team"
         FROM "ServiceTeam" st
         LEFT JOIN "Item" s ON s."id" = st."serviceId"
         LEFT JOIN "Team" "T" ON "T"."id" = st."teamId"
         WHERE st."id" = $1`,
        [serviceTeamId]
      );

      if (!newServiceTeam) {
        return res.status(404).json({ error: 'ServiceTeam not found' });
      }

      const updatedItem = await queryOne<any>(
        `UPDATE "Item" SET "serviceTeamId" = $1, "updatedAt" = $2 WHERE "id" = $3 RETURNING *`,
        [serviceTeamId, new Date(), id]
      );

      if (updatedItem) {
        updatedItem.Client = updatedItem.clientId
          ? await queryOne<any>(`SELECT * FROM "Client" WHERE "id" = $1`, [updatedItem.clientId])
          : null;
        updatedItem.Item = updatedItem.parentId
          ? await queryOne<any>(`SELECT * FROM "Item" WHERE "id" = $1`, [updatedItem.parentId])
          : null;
        updatedItem.ServiceTeam = newServiceTeam;
        updatedItem.User_Item_assigneeIdToUser = updatedItem.assigneeId
          ? await queryOne<any>(
              `SELECT "id", "username", "displayName", "email" FROM "User" WHERE "id" = $1`,
              [updatedItem.assigneeId]
            )
          : null;
      }

      res.json(updatedItem);
      return;
    }

    // 다른 타입(SERVICE, TEAM)은 기존 방식 사용
    if (!parentId) {
      return res.status(400).json({ error: 'parentId is required' });
    }

    const newParent = await queryOne<any>(`SELECT * FROM "Item" WHERE "id" = $1`, [parentId]);
    if (!newParent) {
      return res.status(404).json({ error: 'New parent not found' });
    }

    const validMoves: { [key: string]: ItemType } = {
      [ItemType.TEAM]: ItemType.SERVICE,
      [ItemType.SERVICE]: ItemType.PROJECT,
    };

    if (validMoves[item.type] !== newParent.type) {
      return res.status(400).json({
        error: `Cannot move ${item.type} to ${newParent.type}. ${item.type} can only be moved to ${validMoves[item.type]}`,
      });
    }

    const updatedItem = await queryOne<any>(
      `UPDATE "Item" SET "parentId" = $1, "updatedAt" = $2 WHERE "id" = $3 RETURNING *`,
      [parentId, new Date(), id]
    );

    if (updatedItem) {
      updatedItem.Client = updatedItem.clientId
        ? await queryOne<any>(`SELECT * FROM "Client" WHERE "id" = $1`, [updatedItem.clientId])
        : null;
      updatedItem.Item = await queryOne<any>(`SELECT * FROM "Item" WHERE "id" = $1`, [parentId]);
      updatedItem.User_Item_assigneeIdToUser = updatedItem.assigneeId
        ? await queryOne<any>(
            `SELECT "id", "username", "displayName", "email" FROM "User" WHERE "id" = $1`,
            [updatedItem.assigneeId]
          )
        : null;
    }

    if (item.parentId) {
      await updateItemAndParents(item.parentId);
    }
    await updateItemAndParents(parentId);

    res.json(updatedItem);
  } catch (error: any) {
    errorLogger.error('Failed to move item', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadItemImage = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

    const imageUrl = `/api/items/images/${req.file.filename}`;
    res.json({ url: imageUrl, filename: req.file.filename });
  } catch (error) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    res.status(500).json({ message: 'Failed to upload image' });
  }
};

export const getItemImage = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { filename } = req.params;
    const filepath = path.join(UPLOADS_DIR, 'item-images', filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ message: 'Image not found' });
    res.sendFile(filepath);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get image' });
  }
};
