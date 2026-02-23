import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { ItemType, ItemStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { updateItemAndParents } from '../services/item-calculation.service';
import { appLogger } from '../config/logger';
import {
  softDeleteItem,
  softDeleteProjectWithTeamPreservation,
  softDeleteServiceWithTeamPreservation,
} from '../services/soft-delete.service';
import { NotificationService } from '../services/notification.service';

export const getItems = async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, type, parentId, assigneeId } = req.query;

    const where: any = { isDeleted: false };
    if (clientId) where.clientId = clientId as string;
    if (type) where.type = type as ItemType;
    if (assigneeId) where.assigneeId = assigneeId as string;
    if (parentId === 'null' || parentId === '') {
      where.parentId = null;
    } else if (parentId) {
      where.parentId = parentId as string;
    }

    // Base include configuration
    const includeConfig: any = {
      Client: true,
      Item: true,
      User_Item_assigneeIdToUser: {
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
        },
      },
      other_Item: {
        where: { isDeleted: false },
        include: {
          User_Item_assigneeIdToUser: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
      },
    };

    // If fetching services, include child actions with creator team info (3단계 구조)
    if (type === ItemType.SERVICE) {
      includeConfig.other_Item = {
        where: { isDeleted: false, type: ItemType.ACTION },
        include: {
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
              teamId: true,
              Team: {
                select: {
                  id: true,
                  name: true,
                  level: true,
                },
              },
            },
          },
        },
      };
    }

    // If fetching actions, include hierarchy info via parentId (3단계 구조)
    if (type === ItemType.ACTION) {
      // 3단계 구조: parentId → 서비스 → 프로젝트
      includeConfig.Item = {
        select: {
          id: true,
          name: true,
          parentId: true,
          // 서비스의 부모(프로젝트)
          Item: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      };
      // 생성자의 팀 정보
      includeConfig.User_Item_createdByIdToUser = {
        select: {
          id: true,
          username: true,
          displayName: true,
          teamId: true,
          Team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      };
      // Include counts for dashboard kanban cards
      includeConfig._count = {
        select: {
          Comment: true,
          File: true,
          Link: true,
        },
      };
    }

    const items = await prisma.item.findMany({
      where,
      include: includeConfig,
      orderBy: { order: 'asc' },
    });

    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getItemById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        Client: true,
        User_Item_assigneeIdToUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
        Item: true,
        other_Item: {
          where: { isDeleted: false },
          include: {
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
                teamId: true,
                Team: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        User_Item_createdByIdToUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            teamId: true,
            Team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        ServiceTeamsAsService: {
          include: {
            Team: true,
          },
        },
        ServiceTeam: {
          include: {
            Team: true,
            Service: {
              select: {
                id: true,
                name: true,
                parentId: true,
                Item: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        WorkRequest: {
          include: {
            Requester: {
              select: {
                id: true,
                username: true,
                displayName: true,
                email: true,
              },
            },
            Assignee: {
              select: {
                id: true,
                username: true,
                displayName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
    // ACTION의 parentId는 서비스를 직접 가리킴, 팀 정보는 생성자의 팀에서 가져옴
    let finalParentId = parentId;
    if (type === ItemType.ACTION) {
      // parentId가 있으면 서비스 ID로 직접 사용 (3단계 구조)
      if (parentId) {
        // 서비스가 존재하는지 확인
        const service = await prisma.item.findUnique({
          where: { id: parentId },
          select: { id: true, name: true, type: true },
        });

        if (!service || service.type !== ItemType.SERVICE) {
          return res.status(400).json({ error: 'parentId must be a valid SERVICE for ACTION type' });
        }

        finalParentId = parentId;
        appLogger.info('✅ ACTION parentId set to SERVICE (direct)', {
          actionName: name,
          serviceId: parentId,
          serviceName: service.name,
        });
      }
      // serviceTeamId가 있으면 하위 호환성을 위해 처리
      else if (serviceTeamId) {
        const serviceTeam = await prisma.serviceTeam.findUnique({
          where: { id: serviceTeamId },
          include: {
            Team: true,
            Service: true,
          },
        });

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
      }
      // 둘 다 없으면 에러
      else {
        return res.status(400).json({ error: 'parentId (serviceId) is required for ACTION type' });
      }
    }

    // 상태-진행률 자동 연동
    let finalStatus = status || ItemStatus.NOT_STARTED;
    let finalProgress = progress ?? 0;

    // 상태 → 진행률 연동 (상태가 명시적으로 지정된 경우)
    if (status === ItemStatus.NOT_STARTED && (progress === undefined || progress === null)) {
      finalProgress = 0;
    } else if (status === ItemStatus.COMPLETED && (progress === undefined || progress === null)) {
      finalProgress = 100;
    }
    // 진행률 → 상태 연동 (진행률이 명시적으로 지정된 경우)
    else if (progress === 0 && !status) {
      finalStatus = ItemStatus.NOT_STARTED;
    } else if (progress === 100 && !status) {
      finalStatus = ItemStatus.COMPLETED;
    } else if (progress !== undefined && progress > 0 && progress < 100 && !status) {
      finalStatus = ItemStatus.IN_PROGRESS;
    }

    const item = await prisma.item.create({
      data: {
        id: randomUUID(),
        type,
        name,
        status: finalStatus,
        progress: finalProgress,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        clientId,
        parentId: finalParentId,
        serviceTeamId,
        assigneeId,
        description,
        createdById: req.user!.id,
        updatedAt: new Date(),
      },
      include: {
        Client: true,
        User_Item_assigneeIdToUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

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

    // If item has a parent, update parent chain
    if (parentId) {
      await updateItemAndParents(parentId);
    }

    // If creating a PROJECT, automatically create "미정 서비스" under it
    if (type === ItemType.PROJECT) {
      await prisma.item.create({
        data: {
          id: randomUUID(),
          name: '미정 서비스',
          type: ItemType.SERVICE,
          status: ItemStatus.NOT_STARTED,
          progress: 0,
          parentId: item.id,
          description: '서비스가 미정인 항목들을 위한 임시 서비스',
          createdById: req.user!.id,
          updatedAt: new Date(),
        },
      });
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

      // 🔔 미정 액션 알림: 프로젝트 또는 서비스가 미정인 경우 팀장에게 알림
      if (serviceTeamId) {
        try {
          // ServiceTeam에서 Service 조회
          const serviceTeamForNotify = await prisma.serviceTeam.findUnique({
            where: { id: serviceTeamId },
            include: {
              Service: true,
              Team: true,
            },
          });

          if (serviceTeamForNotify?.Service) {
            // Service의 부모(Project) 조회
            const projectItem = serviceTeamForNotify.Service.parentId
              ? await prisma.item.findUnique({
                  where: { id: serviceTeamForNotify.Service.parentId },
                })
              : null;

            const isProjectUndecided = projectItem?.name.includes('미정') || false;
            const isServiceUndecided = serviceTeamForNotify.Service.name.includes('미정');

            // 미정인 경우 팀장에게 알림
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
          // 알림 실패해도 액션 생성은 성공으로 처리
          appLogger.warn('⚠️ Failed to send undecided action notification', {
            actionId: item.id,
            error: notifyError.message,
          });
        }
      }
    }

    res.status(201).json(item);
  } catch (error: any) {
    appLogger.error('❌ Error creating item', {
      error: error.message,
      stack: error.stack,
      requestBody: req.body,
    });
    res.status(500).json({ error: error.message });
  }
};

export const updateItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingItem = await prisma.item.findUnique({ where: { id } });
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

      // 상태만 변경된 경우 → 진행률 자동 조정
      if (statusChanged && !progressChanged) {
        if (updateData.status === ItemStatus.NOT_STARTED) {
          updateData.progress = 0;
        } else if (updateData.status === ItemStatus.COMPLETED) {
          updateData.progress = 100;
        }
        // 진행중/보류는 기존 진행률 유지
      }
      // 진행률만 변경된 경우 → 상태 자동 조정
      else if (progressChanged && !statusChanged) {
        if (updateData.progress === 0) {
          updateData.status = ItemStatus.NOT_STARTED;
        } else if (updateData.progress === 100) {
          updateData.status = ItemStatus.COMPLETED;
        } else if (updateData.progress > 0 && updateData.progress < 100) {
          // 보류 상태가 아닐 때만 진행중으로 변경
          if (existingItem.status !== ItemStatus.ON_HOLD) {
            updateData.status = ItemStatus.IN_PROGRESS;
          }
        }
      }
    }

    // ACTION: parentId 또는 serviceTeamId 변경 시 처리
    if (existingItem.type === ItemType.ACTION) {
      // parentId가 직접 변경된 경우 (3단계 구조)
      if (updateData.parentId && updateData.parentId !== existingItem.parentId) {
        // 서비스가 존재하는지 확인
        const service = await prisma.item.findUnique({
          where: { id: updateData.parentId },
          select: { id: true, name: true, type: true },
        });

        if (service && service.type === ItemType.SERVICE) {
          appLogger.info('✅ ACTION parentId updated directly', {
            actionId: id,
            newParentId: updateData.parentId,
            serviceName: service.name,
          });
        }
      }
      // serviceTeamId가 변경된 경우 (하위 호환성)
      else if (updateData.serviceTeamId && updateData.serviceTeamId !== existingItem.serviceTeamId) {
        const newServiceTeam = await prisma.serviceTeam.findUnique({
          where: { id: updateData.serviceTeamId },
          select: { serviceId: true },
        });

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

    const item = await prisma.item.update({
      where: { id },
      data: updateData,
      include: {
        Client: true,
        User_Item_assigneeIdToUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    // 🔔 상태 변경/완료 알림
    if (updateData.status && updateData.status !== existingItem.status) {
      try {
        // 상태 변경 알림 (담당자에게, 본인이 변경한 경우 제외)
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

        // 완료 알림 (생성자에게, 본인이 완료한 경우 제외)
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

    // If item has a parent, update parent chain
    // Also update if status, progress, or isOnHold changed
    if (existingItem.parentId && (
      updateData.status !== undefined ||
      updateData.progress !== undefined ||
      updateData.isOnHold !== undefined
    )) {
      await updateItemAndParents(existingItem.parentId);
    }

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingItem = await prisma.item.findUnique({ where: { id } });
    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (existingItem.isDeleted) {
      return res.status(400).json({ error: 'Item is already deleted' });
    }

    // Check permissions: only creator or ADMIN can delete
    const currentUser = req.user!;
    if (currentUser.role !== 'ADMIN' && existingItem.createdById !== currentUser.id) {
      return res.status(403).json({ error: '생성자 또는 최고관리자만 삭제할 수 있습니다' });
    }

    // Use special deletion logic for PROJECT and SERVICE to preserve teams
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
      // For TEAM and ACTION, use regular soft delete
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
    appLogger.error('Failed to delete item', {
      itemId: req.params.id,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
};

export const getItemTree = async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, userTeamId } = req.query;

    const buildTree = async (items: any[], parentClient?: any): Promise<any[]> => {
      return Promise.all(
        items.map(async (item) => {
          // Get comment count for this item
          const commentCount = await prisma.comment.count({
            where: { itemId: item.id },
          });

          // Get file count for this item
          const fileCount = await prisma.file.count({
            where: { itemId: item.id },
          });

          // Get link count for this item
          const linkCount = await prisma.link.count({
            where: { itemId: item.id },
          });

          let children: any[] = [];

          // For TEAM type items, get ACTIONs via ServiceTeam
          if (item.type === ItemType.TEAM) {
            // Find ServiceTeam matching this TEAM item
            const serviceTeam = await prisma.serviceTeam.findFirst({
              where: {
                serviceId: item.parentId, // TEAM's parent is SERVICE
                Team: {
                  name: item.name, // Match by team name
                },
              },
            });

            if (serviceTeam) {
              // Get ACTIONs via ServiceTeam
              children = await prisma.item.findMany({
                where: {
                  type: ItemType.ACTION,
                  serviceTeamId: serviceTeam.id,
                  isDeleted: false,
                },
                include: {
                  Client: true,
                  User_Item_assigneeIdToUser: {
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                    },
                  },
                  // 3단계 구조: 액션 생성자의 팀 정보 포함
                  User_Item_createdByIdToUser: {
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      teamId: true,
                      Team: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                  // 3단계 구조: 부모 서비스 및 프로젝트 정보 포함 (액션 수정 시 필요)
                  Item: {
                    select: {
                      id: true,
                      name: true,
                      parentId: true,
                      Item: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
                orderBy: { order: 'asc' },
              });

              // 로그: TEAM의 자식 ACTION 조회
              if (children.length > 0) {
                appLogger.info('📋 Found ACTIONs for TEAM', {
                  teamId: item.id,
                  teamName: item.name,
                  serviceId: item.parentId,
                  serviceTeamId: serviceTeam.id,
                  actionCount: children.length,
                  actionDates: children.map(c => ({
                    name: c.name,
                    startDate: c.startDate,
                    endDate: c.endDate,
                  })),
                });
              }
            }
          } else {
            // For other types, use parentId-based children
            children = await prisma.item.findMany({
              where: {
                parentId: item.id,
                isDeleted: false,
              },
              include: {
                Client: true,
                User_Item_assigneeIdToUser: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                  },
                },
                // 3단계 구조: 액션 생성자의 팀 정보 포함
                User_Item_createdByIdToUser: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    teamId: true,
                    Team: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
                // 3단계 구조: 부모 서비스 및 프로젝트 정보 포함 (액션 수정 시 필요)
                Item: {
                  select: {
                    id: true,
                    name: true,
                    parentId: true,
                    Item: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            });
          }

          // ACTION 타입 자식들을 팀 이름 기준 가나다순으로 정렬
          if (children.length > 0 && children.some((c: any) => c.type === ItemType.ACTION)) {
            children.sort((a: any, b: any) => {
              // ACTION 타입만 팀 이름으로 정렬
              if (a.type === ItemType.ACTION && b.type === ItemType.ACTION) {
                const teamA = a.User_Item_createdByIdToUser?.Team?.name || '';
                const teamB = b.User_Item_createdByIdToUser?.Team?.name || '';
                return teamA.localeCompare(teamB, 'ko');
              }
              // ACTION이 아닌 타입은 기존 order 유지
              return (a.order || 0) - (b.order || 0);
            });
          }

          // Use parent's Client if child doesn't have one
          const effectiveClient = item.Client || parentClient;

          // Process children first (recursive call)
          const processedChildren = children.length > 0 ? await buildTree(children, effectiveClient) : [];

          // Auto-calculate TEAM dates based on processed children ACTIONs
          let calculatedStartDate = item.startDate;
          let calculatedEndDate = item.endDate;

          // Debug log for TEAM items
          if (item.type === ItemType.TEAM) {
            appLogger.info('🔍 Processing TEAM item', {
              teamId: item.id,
              teamName: item.name,
              processedChildrenCount: processedChildren.length,
              hasOriginalDates: !!(item.startDate || item.endDate),
            });
          }

          if (item.type === ItemType.TEAM && processedChildren.length > 0) {
            // Filter children with valid dates
            const datesFromChildren = processedChildren
              .filter(child => child.startDate || child.endDate)
              .map(child => ({
                startDate: child.startDate ? new Date(child.startDate) : null,
                endDate: child.endDate ? new Date(child.endDate) : null,
              }));

            if (datesFromChildren.length > 0) {
              // Find earliest start date
              const startDates = datesFromChildren
                .map(d => d.startDate)
                .filter((d): d is Date => d !== null);

              if (startDates.length > 0) {
                calculatedStartDate = new Date(Math.min(...startDates.map(d => d.getTime())));
              }

              // Find latest end date
              const endDates = datesFromChildren
                .map(d => d.endDate)
                .filter((d): d is Date => d !== null);

              if (endDates.length > 0) {
                calculatedEndDate = new Date(Math.max(...endDates.map(d => d.getTime())));
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
      // Find the user's team
      const userTeam = await prisma.team.findUnique({
        where: { id: userTeamId as string },
      });

      if (!userTeam) {
        return res.json([]);
      }

      // Get ServiceTeams for this team
      const serviceTeams = await prisma.serviceTeam.findMany({
        where: {
          teamId: userTeam.id,
          Service: {
            isDeleted: false,
          },
        },
        include: {
          Service: {
            select: {
              id: true,
              parentId: true,
              isDeleted: true,
            },
          },
        },
      });

      // Collect unique project IDs
      const projectIds = new Set<string>();
      serviceTeams.forEach((st) => {
        if (st.Service.parentId) {
          projectIds.add(st.Service.parentId);
        }
      });

      // Get all projects related to user's team
      const projects = await prisma.item.findMany({
        where: {
          id: { in: Array.from(projectIds) },
          type: ItemType.PROJECT,  // 🔧 Fix: Ensure only PROJECTs
          parentId: null,
          isDeleted: false,
        },
        include: {
          Client: true,
          User_Item_assigneeIdToUser: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          _count: {
            select: { Comment: true },
          },
        },
        orderBy: { order: 'asc' },
      });

      // Build tree but filter to only include services with user's team
      const serviceIdsWithUserTeam = new Set(serviceTeams.map(st => st.serviceId));
      const filteredTree = await Promise.all(
        projects.map(async (project) => {
          const allServices = await prisma.item.findMany({
            where: {
              parentId: project.id,
              isDeleted: false,
            },
            include: {
              Client: true,
              User_Item_assigneeIdToUser: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                },
              },
              _count: {
                select: { Comment: true },
              },
            },
            orderBy: { order: 'asc' },
          });

          // Filter services that have the user's team
          const servicesWithUserTeam = [];
          for (const service of allServices) {
            if (serviceIdsWithUserTeam.has(service.id)) {
              // Build tree for this service, passing project's Client
              const serviceWithTree = {
                ...service,
                Client: service.Client || project.Client,
                children: await buildTree([service], project.Client).then(built => built[0]?.children || []),
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
    const where: any = {
      parentId: null,
      type: ItemType.PROJECT,  // 🔧 Fix: Only get PROJECTs at root level
      isDeleted: false
    };
    if (clientId) where.clientId = clientId as string;

    const rootItems = await prisma.item.findMany({
      where,
      include: {
        Client: true,
        User_Item_assigneeIdToUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        _count: {
          select: { Comment: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    const tree = await buildTree(rootItems);

    res.json(tree);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const moveItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { parentId, serviceTeamId } = req.body;

    // 아이템 존재 확인
    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        Item: true, // 현재 부모
        ServiceTeam: true, // 현재 ServiceTeam (ACTION용)
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // ACTION 타입인 경우 serviceTeamId로 이동
    if (item.type === ItemType.ACTION) {
      if (!serviceTeamId) {
        return res.status(400).json({ error: 'serviceTeamId is required for ACTION type' });
      }

      // ServiceTeam 존재 및 유효성 확인
      const newServiceTeam = await prisma.serviceTeam.findUnique({
        where: { id: serviceTeamId },
        include: {
          Service: true,
          Team: true,
        },
      });

      if (!newServiceTeam) {
        return res.status(404).json({ error: 'ServiceTeam not found' });
      }

      // 이동 실행 (ACTION은 serviceTeamId만 업데이트)
      const updatedItem = await prisma.item.update({
        where: { id },
        data: {
          serviceTeamId: serviceTeamId,
          updatedAt: new Date(),
        },
        include: {
          Client: true,
          Item: true,
          ServiceTeam: {
            include: {
              Service: true,
              Team: true,
            },
          },
          User_Item_assigneeIdToUser: {
            select: {
              id: true,
              username: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      res.json(updatedItem);
      return;
    }

    // 다른 타입(SERVICE, TEAM)은 기존 방식 사용
    if (!parentId) {
      return res.status(400).json({ error: 'parentId is required' });
    }

    // 새 부모 존재 확인
    const newParent = await prisma.item.findUnique({
      where: { id: parentId },
    });

    if (!newParent) {
      return res.status(404).json({ error: 'New parent not found' });
    }

    // 타입 검증: 계층 구조가 올바른지 확인
    const validMoves: { [key: string]: ItemType } = {
      [ItemType.TEAM]: ItemType.SERVICE,
      [ItemType.SERVICE]: ItemType.PROJECT,
    };

    if (validMoves[item.type] !== newParent.type) {
      return res.status(400).json({
        error: `Cannot move ${item.type} to ${newParent.type}. ${item.type} can only be moved to ${validMoves[item.type]}`,
      });
    }

    // 이동 실행
    const updatedItem = await prisma.item.update({
      where: { id },
      data: {
        parentId: parentId,
        updatedAt: new Date(),
      },
      include: {
        Client: true,
        Item: true,
        User_Item_assigneeIdToUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    // 이전 부모와 새 부모의 진행률 재계산
    if (item.parentId) {
      await updateItemAndParents(item.parentId);
    }
    await updateItemAndParents(parentId);

    res.json(updatedItem);
  } catch (error: any) {
    console.error('Failed to move item:', error);
    res.status(500).json({ error: error.message });
  }
};