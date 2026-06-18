import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../config/database';
import { randomUUID } from 'crypto';
import { FeedbackStatus, FeedbackType, UserRole } from '../types/enums';
import fs from 'fs';
import appLogger, { errorLogger } from '../config/logger';
import { UPLOADS_DIR } from '../config/paths';

/**
 * Get all feedbacks (with filtering)
 */
export const getAllFeedbacks = async (req: AuthRequest, res: Response) => {
  try {
    const { type, status, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: any[] = [];

    if (type && type !== 'ALL') {
      params.push(type);
      conditions.push(`f.type = $${params.length}`);
    }

    if (status && status !== 'ALL') {
      params.push(status);
      conditions.push(`f.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await queryOne<any>(
      `SELECT COUNT(*) AS total FROM "Feedback" f ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.total ?? '0');

    const dataParams = [...params, limitNum, offset];
    const rows = await query<any>(
      `SELECT f.*,
              u.id AS "cb_id", u."displayName" AS "cb_displayName", u.username AS "cb_username",
              ut.id AS "cb_team_id", ut.name AS "cb_team_name",
              r.id AS "rb_id", r."displayName" AS "rb_displayName"
       FROM "Feedback" f
       LEFT JOIN "User" u ON u.id = f."createdById"
       LEFT JOIN "Team" ut ON ut.id = u."teamId"
       LEFT JOIN "User" r ON r.id = f."resolvedById"
       ${whereClause}
       ORDER BY f."createdAt" DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    const feedbacks = rows.map((f: any) => {
      const result: any = {};
      for (const key of Object.keys(f)) {
        if (!key.startsWith('cb_') && !key.startsWith('rb_')) {
          result[key] = f[key];
        }
      }
      result.CreatedBy = f.cb_id ? {
        id: f.cb_id,
        displayName: f.cb_displayName,
        username: f.cb_username,
        Team: f.cb_team_id ? { id: f.cb_team_id, name: f.cb_team_name } : null,
      } : null;
      result.ResolvedBy = f.rb_id ? {
        id: f.rb_id,
        displayName: f.rb_displayName,
      } : null;
      return result;
    });

    res.json({
      data: feedbacks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    errorLogger.error('Error fetching feedbacks:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get feedback by ID
 */
export const getFeedbackById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const f = await queryOne<any>(
      `SELECT f.*,
              u.id AS "cb_id", u."displayName" AS "cb_displayName", u.username AS "cb_username",
              ut.id AS "cb_team_id", ut.name AS "cb_team_name",
              r.id AS "rb_id", r."displayName" AS "rb_displayName"
       FROM "Feedback" f
       LEFT JOIN "User" u ON u.id = f."createdById"
       LEFT JOIN "Team" ut ON ut.id = u."teamId"
       LEFT JOIN "User" r ON r.id = f."resolvedById"
       WHERE f.id = $1`,
      [id]
    );

    if (!f) {
      return res.status(404).json({ error: 'Not found' });
    }

    const feedback: any = {};
    for (const key of Object.keys(f)) {
      if (!key.startsWith('cb_') && !key.startsWith('rb_')) {
        feedback[key] = f[key];
      }
    }
    feedback.CreatedBy = f.cb_id ? {
      id: f.cb_id,
      displayName: f.cb_displayName,
      username: f.cb_username,
      Team: f.cb_team_id ? { id: f.cb_team_id, name: f.cb_team_name } : null,
    } : null;
    feedback.ResolvedBy = f.rb_id ? {
      id: f.rb_id,
      displayName: f.rb_displayName,
    } : null;

    res.json(feedback);
  } catch (error) {
    errorLogger.error('Error fetching feedback:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create new feedback
 */
export const createFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, type } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!title || !content || !type) {
      return res.status(400).json({ error: 'Title, content, and type are required' });
    }

    const feedbackId = randomUUID();
    const now = new Date();

    await query(
      `INSERT INTO "Feedback" (id, title, content, type, "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [feedbackId, title, content, type as FeedbackType, userId, now, now]
    );

    const f = await queryOne<any>(
      `SELECT f.*,
              u.id AS "cb_id", u."displayName" AS "cb_displayName", u.username AS "cb_username",
              ut.id AS "cb_team_id", ut.name AS "cb_team_name"
       FROM "Feedback" f
       LEFT JOIN "User" u ON u.id = f."createdById"
       LEFT JOIN "Team" ut ON ut.id = u."teamId"
       WHERE f.id = $1`,
      [feedbackId]
    );

    const feedback: any = {};
    for (const key of Object.keys(f)) {
      if (!key.startsWith('cb_')) {
        feedback[key] = f[key];
      }
    }
    feedback.CreatedBy = f.cb_id ? {
      id: f.cb_id,
      displayName: f.cb_displayName,
      username: f.cb_username,
      Team: f.cb_team_id ? { id: f.cb_team_id, name: f.cb_team_name } : null,
    } : null;

    res.status(201).json(feedback);
  } catch (error) {
    errorLogger.error('Error creating feedback:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update feedback (author can update title/content if PENDING, admin can update status/adminComment)
 */
export const updateFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, status, adminComment } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await queryOne<any>(
      `SELECT * FROM "Feedback" WHERE id = $1`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Not found' });
    }

    const isAdmin = userRole === UserRole.ADMIN;
    const isAuthor = existing.createdById === userId;

    // Check if user has permission to update
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: 'You do not have permission to update this feedback' });
    }

    // Build SET clauses
    const setClauses: string[] = ['\"updatedAt\" = $1'];
    const params: any[] = [new Date()];

    // Author can update title/content only if status is PENDING
    if (isAuthor && existing.status === FeedbackStatus.PENDING) {
      if (title !== undefined) {
        params.push(title);
        setClauses.push(`title = $${params.length}`);
      }
      if (content !== undefined) {
        params.push(content);
        setClauses.push(`content = $${params.length}`);
      }
    }

    // Admin can update status and adminComment
    if (isAdmin) {
      if (status !== undefined) {
        params.push(status as FeedbackStatus);
        setClauses.push(`status = $${params.length}`);

        if (status === FeedbackStatus.RESOLVED || status === FeedbackStatus.REJECTED) {
          params.push(new Date());
          setClauses.push(`"resolvedAt" = $${params.length}`);
          params.push(userId);
          setClauses.push(`"resolvedById" = $${params.length}`);
        } else {
          setClauses.push(`"resolvedAt" = NULL`);
          setClauses.push(`"resolvedById" = NULL`);
        }
      }
      if (adminComment !== undefined) {
        params.push(adminComment);
        setClauses.push(`"adminComment" = $${params.length}`);
      }
    }

    params.push(id);
    await query(
      `UPDATE "Feedback" SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params
    );

    const f = await queryOne<any>(
      `SELECT f.*,
              u.id AS "cb_id", u."displayName" AS "cb_displayName", u.username AS "cb_username",
              ut.id AS "cb_team_id", ut.name AS "cb_team_name",
              r.id AS "rb_id", r."displayName" AS "rb_displayName"
       FROM "Feedback" f
       LEFT JOIN "User" u ON u.id = f."createdById"
       LEFT JOIN "Team" ut ON ut.id = u."teamId"
       LEFT JOIN "User" r ON r.id = f."resolvedById"
       WHERE f.id = $1`,
      [id]
    );

    const feedback: any = {};
    for (const key of Object.keys(f)) {
      if (!key.startsWith('cb_') && !key.startsWith('rb_')) {
        feedback[key] = f[key];
      }
    }
    feedback.CreatedBy = f.cb_id ? {
      id: f.cb_id,
      displayName: f.cb_displayName,
      username: f.cb_username,
      Team: f.cb_team_id ? { id: f.cb_team_id, name: f.cb_team_name } : null,
    } : null;
    feedback.ResolvedBy = f.rb_id ? {
      id: f.rb_id,
      displayName: f.rb_displayName,
    } : null;

    res.json(feedback);
  } catch (error) {
    errorLogger.error('Error updating feedback:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete feedback (author can delete if PENDING, admin can always delete)
 */
export const deleteFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const feedback = await queryOne<any>(
      `SELECT * FROM "Feedback" WHERE id = $1`,
      [id]
    );

    if (!feedback) {
      return res.status(404).json({ error: 'Not found' });
    }

    const isAdmin = userRole === UserRole.ADMIN;
    const isAuthor = feedback.createdById === userId;

    // Check permission
    if (!isAdmin && !(isAuthor && feedback.status === FeedbackStatus.PENDING)) {
      return res.status(403).json({
        error: isAuthor
          ? 'You can only delete your feedback while it is pending'
          : 'You do not have permission to delete this feedback'
      });
    }

    await query(`DELETE FROM "Feedback" WHERE id = $1`, [id]);

    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    errorLogger.error('Error deleting feedback:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get feedback statistics (for dashboard)
 */
export const getFeedbackStats = async (req: AuthRequest, res: Response) => {
  try {
    const [totalRow, pendingRow, inProgressRow, resolvedRow, rejectedRow, byTypeRows] = await Promise.all([
      queryOne<any>(`SELECT COUNT(*) AS cnt FROM "Feedback"`),
      queryOne<any>(`SELECT COUNT(*) AS cnt FROM "Feedback" WHERE status = 'PENDING'`),
      queryOne<any>(`SELECT COUNT(*) AS cnt FROM "Feedback" WHERE status = 'IN_PROGRESS'`),
      queryOne<any>(`SELECT COUNT(*) AS cnt FROM "Feedback" WHERE status = 'RESOLVED'`),
      queryOne<any>(`SELECT COUNT(*) AS cnt FROM "Feedback" WHERE status = 'REJECTED'`),
      query<any>(`SELECT type, COUNT(*) AS cnt FROM "Feedback" GROUP BY type`),
    ]);

    const total = parseInt(totalRow?.cnt ?? '0');
    const pending = parseInt(pendingRow?.cnt ?? '0');
    const inProgress = parseInt(inProgressRow?.cnt ?? '0');
    const resolved = parseInt(resolvedRow?.cnt ?? '0');
    const rejected = parseInt(rejectedRow?.cnt ?? '0');

    const typeStats: Record<string, number> = {
      BUG: 0,
      FEATURE: 0,
      IMPROVEMENT: 0,
    };

    byTypeRows.forEach((item: any) => {
      typeStats[item.type] = parseInt(item.cnt);
    });

    res.json({
      total,
      byStatus: {
        pending,
        inProgress,
        resolved,
        rejected,
      },
      byType: typeStats,
    });
  } catch (error) {
    errorLogger.error('Error fetching feedback stats:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Upload image for feedback content (Tiptap editor)
 */
export const uploadImage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Return the URL for the uploaded image
    const imageUrl = `/api/boards/feedbacks/images/${req.file.filename}`;

    res.json({
      url: imageUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    errorLogger.error('Error uploading feedback image:', { error });
    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // Ignore cleanup error
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get feedback image by filename
 */
export const getImage = async (req: AuthRequest, res: Response) => {
  try {
    const { filename } = req.params;
    const filepath = `${UPLOADS_DIR}/feedback-images/${filename}`;

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.sendFile(filepath);
  } catch (error) {
    errorLogger.error('Error getting feedback image:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
