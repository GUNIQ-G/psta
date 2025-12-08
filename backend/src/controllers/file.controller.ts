import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { UserRole } from '@prisma/client';

/**
 * Upload file to item (action, team, service, or project)
 */
export const uploadFile = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!itemId) {
      return res.status(400).json({ message: 'Item ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
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
      // Delete uploaded file if item doesn't exist
      fs.unlinkSync(req.file.path);
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

    // Decode originalname to handle Korean characters properly
    // multer receives filename in latin1 encoding, need to convert to UTF-8
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // Create file record
    const file = await prisma.file.create({
      data: {
        id: randomUUID(),
        filename: req.file.filename,
        originalName: originalName,
        filepath: req.file.path,
        filesize: req.file.size,
        mimetype: req.file.mimetype,
        itemId,
        projectId,
        serviceId,
        teamId,
        uploadedById: userId,
        updatedAt: new Date(),
      },
      include: {
        UploadedBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    res.json(file);
  } catch (error) {
    console.error('Error uploading file:', error);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Failed to upload file' });
  }
};

/**
 * Get files for an item
 */
export const getItemFiles = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;

    const files = await prisma.file.findMany({
      where: { itemId },
      include: {
        UploadedBy: {
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

    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ message: 'Failed to fetch files' });
  }
};

/**
 * Get all files with hierarchy information
 */
export const getAllFiles = async (req: AuthRequest, res: Response) => {
  try {
    const files = await prisma.file.findMany({
      include: {
        UploadedBy: {
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

    res.json(files);
  } catch (error) {
    console.error('Error fetching all files:', error);
    res.status(500).json({ message: 'Failed to fetch files' });
  }
};

/**
 * Get all files and links for an item and its descendants (hierarchical)
 */
export const getHierarchicalDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;

    // Get the item with its type
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { id: true, type: true },
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    let itemIds: string[] = [itemId];

    // 3단계 구조: PROJECT → SERVICE → ACTION
    // Collect all descendant item IDs based on hierarchy
    switch (item.type) {
      case 'PROJECT':
        // Get all services under this project
        const services = await prisma.item.findMany({
          where: { parentId: itemId, type: 'SERVICE' },
          select: { id: true },
        });
        const serviceIds = services.map(s => s.id);
        itemIds = [...itemIds, ...serviceIds];

        // Get all actions under these services (3단계 구조)
        const actions = await prisma.item.findMany({
          where: { parentId: { in: serviceIds }, type: 'ACTION' },
          select: { id: true },
        });
        const actionIds = actions.map(a => a.id);
        itemIds = [...itemIds, ...actionIds];
        break;

      case 'SERVICE':
        // Get all actions under this service (3단계 구조)
        const serviceActions = await prisma.item.findMany({
          where: { parentId: itemId, type: 'ACTION' },
          select: { id: true },
        });
        const serviceActionIds = serviceActions.map(a => a.id);
        itemIds = [...itemIds, ...serviceActionIds];
        break;

      case 'ACTION':
        // Only this action
        break;
    }

    // Get all files for these items (with hierarchy info)
    const files = await prisma.file.findMany({
      where: { itemId: { in: itemIds } },
      include: {
        UploadedBy: {
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
          select: {
            id: true,
            name: true,
            type: true,
            Item: {
              select: {
                id: true,
                name: true,
                type: true,
                Item: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
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

    // Get all links for these items (with hierarchy info)
    const links = await prisma.link.findMany({
      where: { itemId: { in: itemIds } },
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
          select: {
            id: true,
            name: true,
            type: true,
            Item: {
              select: {
                id: true,
                name: true,
                type: true,
                Item: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
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

    res.json({ files, links });
  } catch (error) {
    console.error('Error fetching hierarchical documents:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
};

/**
 * Delete file
 * Only ADMIN or uploader can delete
 */
export const deleteFile = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get file
    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check permissions: only ADMIN or uploader can delete
    if (userRole !== UserRole.ADMIN && file.uploadedById !== userId) {
      return res.status(403).json({ message: 'You do not have permission to delete this file' });
    }

    // Delete file from filesystem
    if (fs.existsSync(file.filepath)) {
      fs.unlinkSync(file.filepath);
    }

    // Delete file record
    await prisma.file.delete({
      where: { id },
    });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'Failed to delete file' });
  }
};
