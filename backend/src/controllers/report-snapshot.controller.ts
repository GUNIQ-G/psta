import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import appLogger, { errorLogger } from '../config/logger';
import { USER_SELECT } from '../utils/prisma-selects';

/**
 * Create a new report snapshot
 * POST /api/report-snapshots
 */
export const createSnapshot = async (req: AuthRequest, res: Response) => {
  try {
    const { title, clientId, clientName, startDate, endDate, data, statistics } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate required fields
    if (!title || !clientId || !clientName || !startDate || !endDate || !data || !statistics) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const snapshot = await prisma.reportSnapshot.create({
      data: {
        id: randomUUID(),
        title,
        clientId,
        clientName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        data: JSON.stringify(data),
        statistics: JSON.stringify(statistics),
        createdById: userId,
      },
      include: {
        CreatedBy: {
          select: USER_SELECT,
        },
      },
    });

    // Parse JSON strings back to objects for response
    const response = {
      ...snapshot,
      data: JSON.parse(snapshot.data),
      statistics: JSON.parse(snapshot.statistics),
    };

    res.status(201).json(response);
  } catch (error: any) {
    errorLogger.error('Create snapshot error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all snapshots (with optional filtering by clientId)
 * GET /api/report-snapshots?clientId=xxx
 */
export const getSnapshots = async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.query;

    const where = clientId ? { clientId: clientId as string } : {};

    const snapshots = await prisma.reportSnapshot.findMany({
      where,
      include: {
        CreatedBy: {
          select: USER_SELECT,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Parse JSON strings back to objects
    const response = snapshots.map(snapshot => ({
      ...snapshot,
      data: JSON.parse(snapshot.data),
      statistics: JSON.parse(snapshot.statistics),
    }));

    res.json(response);
  } catch (error: any) {
    errorLogger.error('Get snapshots error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get a single snapshot by ID
 * GET /api/report-snapshots/:id
 */
export const getSnapshotById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const snapshot = await prisma.reportSnapshot.findUnique({
      where: { id },
      include: {
        CreatedBy: {
          select: USER_SELECT,
        },
      },
    });

    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    // Parse JSON strings back to objects
    const response = {
      ...snapshot,
      data: JSON.parse(snapshot.data),
      statistics: JSON.parse(snapshot.statistics),
    };

    res.json(response);
  } catch (error: any) {
    errorLogger.error('Get snapshot by ID error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a snapshot
 * DELETE /api/report-snapshots/:id
 */
export const deleteSnapshot = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if snapshot exists
    const snapshot = await prisma.reportSnapshot.findUnique({
      where: { id },
    });

    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    // Only ADMIN or creator can delete
    if (userRole !== 'ADMIN' && snapshot.createdById !== userId) {
      return res.status(403).json({ error: 'Permission denied. Only ADMIN or creator can delete snapshots.' });
    }

    await prisma.reportSnapshot.delete({
      where: { id },
    });

    res.json({ message: 'Snapshot deleted successfully' });
  } catch (error: any) {
    errorLogger.error('Delete snapshot error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
