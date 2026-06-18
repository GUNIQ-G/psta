import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../config/database';
import { errorLogger } from '../config/logger';

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;
    const { unreadOnly } = req.query;

    // 7일 전 날짜 계산
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let sql = `
      SELECT
        n.*,
        json_build_object(
          'id', fu."id",
          'displayName', fu."displayName",
          'email', fu."email"
        ) AS "FromUser"
      FROM "Notification" n
      LEFT JOIN "User" fu ON fu."id" = n."fromUserId"
      WHERE n."toUserId" = $1
        AND (
          n."isRead" = false
          OR (n."isRead" = true AND n."createdAt" >= $2)
        )
    `;
    const params: any[] = [userId, sevenDaysAgo];

    if (unreadOnly === 'true') {
      sql += ` AND n."isRead" = false`;
    }

    sql += ` ORDER BY n."createdAt" DESC LIMIT 50`;

    const notifications = await query(sql, params);

    res.json(notifications);
  } catch (error) {
    errorLogger.error('Get notifications error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;

    const row = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "Notification" WHERE "toUserId" = $1 AND "isRead" = false`,
      [userId]
    );

    res.json({ count: row?.count ?? 0 });
  } catch (error) {
    errorLogger.error('Get unread count error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const notification = await queryOne<any>(
      `SELECT * FROM "Notification" WHERE "id" = $1`,
      [id]
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.toUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await query(
      `UPDATE "Notification" SET "isRead" = true, "updatedAt" = $1 WHERE "id" = $2`,
      [new Date(), id]
    );

    res.json({ message: 'Marked as read' });
  } catch (error) {
    errorLogger.error('Mark as read error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;

    await query(
      `UPDATE "Notification" SET "isRead" = true, "updatedAt" = $1 WHERE "toUserId" = $2 AND "isRead" = false`,
      [new Date(), userId]
    );

    res.json({ message: 'All marked as read' });
  } catch (error) {
    errorLogger.error('Mark all as read error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
