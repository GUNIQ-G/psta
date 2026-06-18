import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../config/database';
import appLogger, { errorLogger } from '../config/logger';

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

    const newId = randomUUID();
    const snapshot = await queryOne<any>(`
      WITH inserted AS (
        INSERT INTO "ReportSnapshot" (
          "id", "title", "clientId", "clientName",
          "startDate", "endDate", "data", "statistics",
          "createdById", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      )
      SELECT
        i.*,
        json_build_object(
          'id', u."id",
          'username', u."username",
          'displayName', u."displayName",
          'email', u."email"
        ) AS "CreatedBy"
      FROM inserted i
      LEFT JOIN "User" u ON u."id" = i."createdById"
    `, [
      newId,
      title,
      clientId,
      clientName,
      new Date(startDate),
      new Date(endDate),
      JSON.stringify(data),
      JSON.stringify(statistics),
      userId,
    ]);

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

    let sql = `
      SELECT
        s.*,
        json_build_object(
          'id', u."id",
          'username', u."username",
          'displayName', u."displayName",
          'email', u."email"
        ) AS "CreatedBy"
      FROM "ReportSnapshot" s
      LEFT JOIN "User" u ON u."id" = s."createdById"
    `;
    const params: any[] = [];

    if (clientId) {
      sql += ` WHERE s."clientId" = $1`;
      params.push(clientId as string);
    }

    sql += ` ORDER BY s."createdAt" DESC`;

    const snapshots = await query(sql, params);

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

    const snapshot = await queryOne<any>(`
      SELECT
        s.*,
        json_build_object(
          'id', u."id",
          'username', u."username",
          'displayName', u."displayName",
          'email', u."email"
        ) AS "CreatedBy"
      FROM "ReportSnapshot" s
      LEFT JOIN "User" u ON u."id" = s."createdById"
      WHERE s."id" = $1
    `, [id]);

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
    const snapshot = await queryOne<any>(
      `SELECT * FROM "ReportSnapshot" WHERE "id" = $1`,
      [id]
    );

    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    // Only ADMIN or creator can delete
    if (userRole !== 'ADMIN' && snapshot.createdById !== userId) {
      return res.status(403).json({ error: 'Permission denied. Only ADMIN or creator can delete snapshots.' });
    }

    await query(`DELETE FROM "ReportSnapshot" WHERE "id" = $1`, [id]);

    res.json({ message: 'Snapshot deleted successfully' });
  } catch (error: any) {
    errorLogger.error('Delete snapshot error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
