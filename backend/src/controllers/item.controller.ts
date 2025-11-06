import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import slackService from '../services/slack.service';
import { ItemType, ItemStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { updateItemAndParents } from '../services/item-calculation.service';
import { appLogger } from '../config/logger';

export const getItems = async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, type, parentId } = req.query;

    const where: any = {};
    if (clientId) where.clientId = clientId as string;
    if (type) where.type = type as ItemType;
    if (parentId === 'null' || parentId === '') {
      where.parentId = null;
    } else if (parentId) {
      where.parentId = parentId as string;
    }

    const items = await prisma.item.findMany({
      where,
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
        other_Item: {
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
      },
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
        User_Item_createdByIdToUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
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
      assigneeId,
      description,
    } = req.body;

    // Debug logging
    console.log('=== CREATE ITEM DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('clientId:', clientId);
    console.log('parentId:', parentId);
    console.log('========================');

    if (!type || !name) {
      return res.status(400).json({ error: 'Type and name are required' });
    }

    const item = await prisma.item.create({
      data: {
        id: randomUUID(),
        type,
        name,
        status: status || ItemStatus.NOT_STARTED,
        progress: progress || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        clientId,
        parentId,
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

    if (assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (assignee) {
        await slackService.notifyItemCreated(type, name, assignee.displayName);
      }
    }

    // If item has a parent, update parent chain
    if (parentId) {
      await updateItemAndParents(parentId);
    }

    res.status(201).json(item);
  } catch (error: any) {
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

    if (updateData.status && updateData.status !== existingItem.status) {
      await slackService.notifyItemStatusChanged(
        item.type,
        item.name,
        existingItem.status,
        updateData.status
      );

      if (updateData.status === ItemStatus.COMPLETED && item.User_Item_assigneeIdToUser) {
        await slackService.notifyItemCompleted(item.type, item.name, item.User_Item_assigneeIdToUser.displayName);
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

    // Check permissions: only creator or ADMIN can delete
    const currentUser = req.user!;
    if (currentUser.role !== 'ADMIN' && existingItem.createdById !== currentUser.id) {
      return res.status(403).json({ error: '생성자 또는 최고관리자만 삭제할 수 있습니다' });
    }

    await prisma.item.delete({ where: { id } });

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getItemTree = async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, userTeamId } = req.query;

    const buildTree = async (items: any[]): Promise<any[]> => {
      return Promise.all(
        items.map(async (item) => {
          // Get comment count for this item
          const commentCount = await prisma.comment.count({
            where: { itemId: item.id },
          });

          const children = await prisma.item.findMany({
            where: { parentId: item.id },
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
            orderBy: { order: 'asc' },
          });

          return {
            ...item,
            _count: {
              Comment: commentCount,
            },
            children: children.length > 0 ? await buildTree(children) : [],
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

      const teamItems = await prisma.item.findMany({
        where: {
          type: 'TEAM',
          name: userTeam.name,
        },
        include: {
          Item: {
            include: {
              Item: true, // Get the project (grandparent)
            },
          },
        },
      });

      // Collect unique project IDs
      const projectIds = new Set<string>();
      teamItems.forEach((teamItem) => {
        if (teamItem.Item?.Item) {
          // Service -> Project
          projectIds.add(teamItem.Item.Item.id);
        }
      });

      // Get all projects related to user's team
      const projects = await prisma.item.findMany({
        where: {
          id: { in: Array.from(projectIds) },
          parentId: null,
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
      const filteredTree = await Promise.all(
        projects.map(async (project) => {
          const allServices = await prisma.item.findMany({
            where: { parentId: project.id },
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
            const teams = await prisma.item.findMany({
              where: {
                parentId: service.id,
                type: 'TEAM',
                name: userTeam.name,
              },
            });

            if (teams.length > 0) {
              // Build tree for this service
              const serviceWithTree = {
                ...service,
                children: await buildTree([service]).then(built => built[0]?.children || []),
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

    // Default behavior: show all items
    const where: any = { parentId: null };
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

export const getMyTasks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get all ACTION items assigned to the current user
    const items = await prisma.item.findMany({
      where: {
        assigneeId: userId,
        type: ItemType.ACTION,
      },
      include: {
        Client: true,
        User_Item_assigneeIdToUser: true,
        Item: true,
        _count: {
          select: {
            Comment: true,
            File: true,
            Link: true,
          },
        },
      },
      orderBy: [
        {
          status: 'asc',
        },
        {
          endDate: 'asc',
        },
      ],
    });

    console.log('===== RAW ITEMS FROM DB =====');
    console.log('First item name:', items[0]?.name);
    console.log('First item _count:', items[0]?._count);
    console.log('Has _count?', '_count' in (items[0] || {}));
    console.log('================================');

    // Get parent hierarchy for each item
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        let teamName = null;
        let serviceName = null;
        let projectName = null;

        // If item has parent (should be TEAM)
        if (item.Item) {
          teamName = item.Item.name;

          // Get service (parent of team)
          if (item.Item.parentId) {
            const service = await prisma.item.findUnique({
              where: { id: item.Item.parentId },
              select: {
                name: true,
                parentId: true,
              },
            });

            if (service) {
              serviceName = service.name;

              // Get project (parent of service)
              if (service.parentId) {
                const project = await prisma.item.findUnique({
                  where: { id: service.parentId },
                  select: {
                    name: true,
                  },
                });

                if (project) {
                  projectName = project.name;
                }
              }
            }
          }
        }

        return {
          id: item.id,
          type: item.type,
          name: item.name,
          status: item.status,
          progress: item.progress,
          isOnHold: item.isOnHold,
          startDate: item.startDate,
          endDate: item.endDate,
          timeSpent: item.timeSpent,
          description: item.description,
          order: item.order,
          clientId: item.clientId,
          parentId: item.parentId,
          assigneeId: item.assigneeId,
          createdById: item.createdById,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          Client: item.Client,
          User_Item_assigneeIdToUser: item.User_Item_assigneeIdToUser ? {
            id: item.User_Item_assigneeIdToUser.id,
            username: item.User_Item_assigneeIdToUser.username,
            displayName: item.User_Item_assigneeIdToUser.displayName,
          } : null,
          Item: item.Item ? {
            id: item.Item.id,
            name: item.Item.name,
            type: item.Item.type,
            parentId: item.Item.parentId,
          } : null,
          projectName,
          serviceName,
          teamName,
          _count: item._count,
        };
      })
    );

    // Custom sort to prioritize IN_PROGRESS, then NOT_STARTED, then ON_HOLD, then COMPLETED
    const statusOrder: { [key in ItemStatus]: number } = {
      [ItemStatus.IN_PROGRESS]: 1,
      [ItemStatus.NOT_STARTED]: 2,
      [ItemStatus.ON_HOLD]: 3,
      [ItemStatus.COMPLETED]: 4,
    };

    const sortedItems = enrichedItems.sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;

      // If same status, sort by end date
      if (a.endDate && b.endDate) {
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      }
      if (a.endDate) return -1;
      if (b.endDate) return 1;
      return 0;
    });

    console.log('===== RESPONSE TO CLIENT =====');
    console.log('First item name:', sortedItems[0]?.name);
    console.log('First item _count:', sortedItems[0]?._count);
    console.log('Has _count in response?', '_count' in (sortedItems[0] || {}));
    console.log('Keys:', Object.keys(sortedItems[0] || {}));
    console.log('================================');

    // Disable cache to force fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json(sortedItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const moveItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { parentId } = req.body;

    if (!parentId) {
      return res.status(400).json({ error: 'parentId is required' });
    }

    // 아이템 존재 확인
    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        Item: true, // 현재 부모
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
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
      [ItemType.ACTION]: ItemType.TEAM,
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