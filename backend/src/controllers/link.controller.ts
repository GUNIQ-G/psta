import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { randomUUID } from 'crypto';
import { UserRole } from '@prisma/client';

/**
 * Create link for item (action, team, service, or project)
 */
export const createLink = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId, url, displayName } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!itemId || !url || !displayName) {
      return res.status(400).json({ message: 'Item ID, URL, and display name are required' });
    }

    // Get item with full hierarchy
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        Item: {
          include: {
            Item: {
              include: {
                Item: true, // Project level
              },
            },
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Extract hierarchy IDs
    let projectId: string | null = null;
    let serviceId: string | null = null;
    let teamId: string | null = null;

    // Determine hierarchy based on item type
    switch (item.type) {
      case 'ACTION':
        teamId = item.parentId;
        const team = item.Item;
        if (team) {
          serviceId = team.parentId;
          const service = team.Item;
          if (service) {
            projectId = service.parentId;
          }
        }
        break;
      case 'TEAM':
        teamId = item.id;
        serviceId = item.parentId;
        const teamService = item.Item;
        if (teamService) {
          projectId = teamService.parentId;
        }
        break;
      case 'SERVICE':
        serviceId = item.id;
        projectId = item.parentId;
        break;
      case 'PROJECT':
        projectId = item.id;
        break;
    }

    // Create link record
    const link = await prisma.link.create({
      data: {
        id: randomUUID(),
        url,
        displayName,
        itemId,
        projectId,
        serviceId,
        teamId,
        createdById: userId,
        updatedAt: new Date(),
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    res.json(link);
  } catch (error) {
    console.error('Error creating link:', error);
    res.status(500).json({ message: 'Failed to create link' });
  }
};

/**
 * Get links for an item
 */
export const getItemLinks = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;

    const links = await prisma.link.findMany({
      where: { itemId },
      include: {
        CreatedBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(links);
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ message: 'Failed to fetch links' });
  }
};

/**
 * Get all links with hierarchy information
 */
export const getAllLinks = async (req: AuthRequest, res: Response) => {
  try {
    const links = await prisma.link.findMany({
      include: {
        CreatedBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
            Team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        Item: {
          include: {
            Client: true,
            Item: {
              include: {
                Client: true,
                Item: {
                  include: {
                    Client: true,
                    Item: {
                      include: {
                        Client: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(links);
  } catch (error) {
    console.error('Error fetching all links:', error);
    res.status(500).json({ message: 'Failed to fetch links' });
  }
};

/**
 * Delete link
 * Only ADMIN or creator can delete
 */
export const deleteLink = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get link
    const link = await prisma.link.findUnique({
      where: { id },
    });

    if (!link) {
      return res.status(404).json({ message: 'Link not found' });
    }

    // Check permissions: only ADMIN or creator can delete
    if (userRole !== UserRole.ADMIN && link.createdById !== userId) {
      return res.status(403).json({ message: 'You do not have permission to delete this link' });
    }

    // Delete link record
    await prisma.link.delete({
      where: { id },
    });

    res.json({ message: 'Link deleted successfully' });
  } catch (error) {
    console.error('Error deleting link:', error);
    res.status(500).json({ message: 'Failed to delete link' });
  }
};
