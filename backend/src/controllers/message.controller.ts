import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../config/database';
import { randomUUID } from 'crypto';
import { NotificationService } from '../services/notification.service';
import { errorLogger } from '../config/logger';

// 받은 메시지 목록 조회
export const getReceivedMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { unreadOnly } = req.query;

    let sql = `
      SELECT
        m.*,
        json_build_object(
          'id', fu."id",
          'username', fu."username",
          'displayName', fu."displayName",
          'email', fu."email"
        ) AS "FromUser"
      FROM "Message" m
      LEFT JOIN "User" fu ON fu."id" = m."fromUserId"
      WHERE m."toUserId" = $1
    `;
    const params: any[] = [userId];

    if (unreadOnly === 'true') {
      sql += ` AND m."isRead" = false`;
    }

    sql += ` ORDER BY m."createdAt" DESC`;

    const messages = await query(sql, params);

    res.json(messages);
  } catch (error) {
    errorLogger.error('Get received messages error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 보낸 메시지 목록 조회
export const getSentMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const sql = `
      SELECT
        m.*,
        json_build_object(
          'id', tu."id",
          'username', tu."username",
          'displayName', tu."displayName",
          'email', tu."email"
        ) AS "ToUser"
      FROM "Message" m
      LEFT JOIN "User" tu ON tu."id" = m."toUserId"
      WHERE m."fromUserId" = $1
      ORDER BY m."createdAt" DESC
    `;

    const messages = await query(sql, [userId]);

    res.json(messages);
  } catch (error) {
    errorLogger.error('Get sent messages error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 메시지 상세 조회
export const getMessageById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const message = await queryOne<any>(`
      SELECT
        m.*,
        json_build_object(
          'id', fu."id",
          'username', fu."username",
          'displayName', fu."displayName",
          'email', fu."email"
        ) AS "FromUser",
        json_build_object(
          'id', tu."id",
          'username', tu."username",
          'displayName', tu."displayName",
          'email', tu."email"
        ) AS "ToUser"
      FROM "Message" m
      LEFT JOIN "User" fu ON fu."id" = m."fromUserId"
      LEFT JOIN "User" tu ON tu."id" = m."toUserId"
      WHERE m."id" = $1
    `, [id]);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 권한 체크: 발신자 또는 수신자만 볼 수 있음
    if (message.fromUserId !== userId && message.toUserId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 수신자가 읽을 경우 읽음 처리
    if (message.toUserId === userId && !message.isRead) {
      await query(
        `UPDATE "Message" SET "isRead" = true, "readAt" = $1 WHERE "id" = $2`,
        [new Date(), id]
      );
      message.isRead = true;
    }

    res.json(message);
  } catch (error) {
    errorLogger.error('Get message by id error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 메시지 전송
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { toUserId, subject, content } = req.body;
    const fromUserId = req.user!.id;

    if (!toUserId || !subject || !content) {
      return res.status(400).json({ error: 'toUserId, subject, and content are required' });
    }

    // 수신자 존재 확인
    const toUser = await queryOne<any>(
      `SELECT "id" FROM "User" WHERE "id" = $1`,
      [toUserId]
    );

    if (!toUser) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const newId = randomUUID();
    const message = await queryOne<any>(`
      WITH inserted AS (
        INSERT INTO "Message" ("id", "fromUserId", "toUserId", "subject", "content", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING *
      )
      SELECT
        i.*,
        json_build_object(
          'id', fu."id",
          'username', fu."username",
          'displayName', fu."displayName",
          'email', fu."email"
        ) AS "FromUser",
        json_build_object(
          'id', tu."id",
          'username', tu."username",
          'displayName', tu."displayName",
          'email', tu."email"
        ) AS "ToUser"
      FROM inserted i
      LEFT JOIN "User" fu ON fu."id" = i."fromUserId"
      LEFT JOIN "User" tu ON tu."id" = i."toUserId"
    `, [newId, fromUserId, toUserId, subject, content]);

    // 알림 생성 및 Slack 전송
    await NotificationService.createNotification({
      type: 'message_received',
      content: `${message.FromUser.displayName}님이 메시지를 보냈습니다: "${subject}"`,
      fromUserId,
      toUserId,
      link: '/messages',
      extraContent: content, // 메시지 내용 포함
    }).catch(err => {
      errorLogger.error('Failed to send message notification', { error: err });
      // 알림 실패해도 메시지 전송은 성공으로 처리
    });

    res.status(201).json(message);
  } catch (error) {
    errorLogger.error('Send message error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 읽지 않은 메시지 개수 조회
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const row = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "Message" WHERE "toUserId" = $1 AND "isRead" = false`,
      [userId]
    );

    res.json({ count: row?.count ?? 0 });
  } catch (error) {
    errorLogger.error('Get unread message count error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 메시지 읽음 처리
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const message = await queryOne<any>(
      `SELECT * FROM "Message" WHERE "id" = $1`,
      [id]
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 수신자만 읽음 처리 가능
    if (message.toUserId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedMessage = await queryOne<any>(
      `UPDATE "Message" SET "isRead" = true, "readAt" = $1, "updatedAt" = $2 WHERE "id" = $3 RETURNING *`,
      [new Date(), new Date(), id]
    );

    res.json(updatedMessage);
  } catch (error) {
    errorLogger.error('Mark message as read error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 메시지 삭제
export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const message = await queryOne<any>(
      `SELECT * FROM "Message" WHERE "id" = $1`,
      [id]
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 발신자 또는 수신자만 삭제 가능
    if (message.fromUserId !== userId && message.toUserId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await query(`DELETE FROM "Message" WHERE "id" = $1`, [id]);

    res.status(204).send();
  } catch (error) {
    errorLogger.error('Delete message error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
