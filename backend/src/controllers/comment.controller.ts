import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../config/database';
import crypto from 'crypto';
import { NotificationService } from '../services/notification.service';
import appLogger, { errorLogger } from '../config/logger';

export const getCommentsByItem = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { itemId } = req.params;

    const comments = await query<any>(
      `SELECT c.*, u.id AS "user_id", u."displayName" AS "user_displayName", u.email AS "user_email"
       FROM "Comment" c
       LEFT JOIN "User" u ON u.id = c."userId"
       WHERE c."itemId" = $1
       ORDER BY c."createdAt" DESC`,
      [itemId]
    );

    // Reshape to match Prisma include structure
    const shapedComments = comments.map((row: any) => ({
      id: row.id,
      content: row.content,
      itemId: row.itemId,
      userId: row.userId,
      reactions: row.reactions,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      User: {
        id: row.user_id,
        displayName: row.user_displayName,
        email: row.user_email,
      },
    }));

    // Enrich reactions with user information
    const enrichedComments = await Promise.all(
      shapedComments.map(async (comment: any) => {
        let reactionsWithUsers = {};
        try {
          if (comment.reactions) {
            const reactions = JSON.parse(comment.reactions);

            // Get all unique user IDs from reactions
            const allUserIds = new Set<string>();
            Object.values(reactions).forEach((userIds: any) => {
              userIds.forEach((id: string) => allUserIds.add(id));
            });

            if (allUserIds.size > 0) {
              const idList = Array.from(allUserIds);
              const placeholders = idList.map((_: any, i: number) => `$${i + 1}`).join(', ');
              const users = await query<{ id: string; displayName: string }>(
                `SELECT id, "displayName" FROM "User" WHERE id IN (${placeholders})`,
                idList
              );

              const userMap = new Map(users.map(u => [u.id, u.displayName]));

              // Map reactions to include user names
              reactionsWithUsers = Object.entries(reactions).reduce((acc, [emoji, userIds]) => {
                (acc as any)[emoji] = (userIds as string[]).map(userId => ({
                  userId,
                  displayName: userMap.get(userId) || '알 수 없음',
                }));
                return acc;
              }, {} as any);
            }
          }
        } catch (error) {
          errorLogger.error('Error enriching reactions:', { error });
        }

        return {
          ...comment,
          reactionsWithUsers: JSON.stringify(reactionsWithUsers),
        };
      })
    );

    res.json(enrichedComments);
  } catch (error: any) {
    errorLogger.error('Get comments error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createComment = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { itemId } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    const newId = crypto.randomUUID();
    const now = new Date();

    const commentRow = await queryOne<any>(
      `INSERT INTO "Comment" (id, content, "itemId", "userId", "updatedAt", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING *`,
      [newId, content, itemId, userId, now]
    );

    // Fetch user info for the comment
    const userRow = await queryOne<any>(
      `SELECT id, "displayName", email FROM "User" WHERE id = $1`,
      [userId]
    );

    const comment = {
      ...commentRow,
      User: userRow
        ? { id: userRow.id, displayName: userRow.displayName, email: userRow.email }
        : null,
    };

    // Extract mentions from content and create notifications (format: @[displayName](userId))
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    const mentionedUserIds = new Set<string>();

    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionedUserId = match[2];
      if (mentionedUserId !== userId) { // Don't notify self
        mentionedUserIds.add(mentionedUserId);
      }
    }

    // Get item info for notification and message
    const item = await queryOne<any>(
      `SELECT i.*, u."displayName" AS "assignee_displayName"
       FROM "Item" i
       LEFT JOIN "User" u ON u.id = i."assigneeId"
       WHERE i.id = $1`,
      [itemId]
    );

    const typeLabels: { [key: string]: string } = {
      PROJECT: '프로젝트',
      SERVICE: '서비스',
      TEAM: '팀',
      ACTION: '액션',
    };

    const statusLabels: { [key: string]: string } = {
      NOT_STARTED: '시작 전',
      IN_PROGRESS: '진행중',
      COMPLETED: '완료',
      ON_HOLD: '대기',
    };

    // Create notifications and messages for mentioned users
    for (const toUserId of mentionedUserIds) {
      // Create notification (automatically sends to Slack too)
      await NotificationService.createNotification({
        type: 'comment_mention',
        content: `${req.user!.displayName}님이 "${item?.name || '항목'}"에서 회원님을 멘션했습니다.`,
        itemId,
        commentId: comment.id,
        fromUserId: userId,
        toUserId,
        extraContent: content, // 댓글 내용 추가
      });

      // Create message with comment content and structured info
      const typeLabel = item?.type ? typeLabels[item.type] : '항목';
      const statusLabel = item?.status ? statusLabels[item.status] : '-';
      const assigneeName = item?.assignee_displayName || '미배정';
      const progress = item?.progress || 0;

      // Format dates
      let dateRange = '기간 미정';
      if (item?.startDate && item?.endDate) {
        const startDate = new Date(item.startDate);
        const endDate = new Date(item.endDate);
        const formatDate = (date: Date) => {
          return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        };
        dateRange = `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
      }

      const messageContent = `${content}\n\n━━━━━━━━━━━━━━━━━━━━\n[ITEM_INFO]${typeLabel}|${statusLabel}|${item?.name || '항목'}|${assigneeName}|${dateRange}|${progress}[/ITEM_INFO]\n[LINK]${process.env.FRONTEND_URL || 'http://localhost:3000'}/psta?itemId=${itemId}[/LINK]`;

      await queryOne<any>(
        `INSERT INTO "Message" (id, subject, content, "fromUserId", "toUserId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING *`,
        [
          crypto.randomUUID(),
          `[멘션 알림] (${typeLabel}) ${item?.name || '항목'}`,
          messageContent,
          userId,
          toUserId,
          new Date(),
        ]
      );
    }

    res.json(comment);
  } catch (error: any) {
    errorLogger.error('Create comment error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteComment = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if comment belongs to user
    const comment = await queryOne<any>(
      `SELECT * FROM "Comment" WHERE id = $1`,
      [id]
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await query(`DELETE FROM "Comment" WHERE id = $1`, [id]);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error: any) {
    errorLogger.error('Delete comment error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleReaction = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user!.id;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const comment = await queryOne<any>(
      `SELECT * FROM "Comment" WHERE id = $1`,
      [id]
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Parse existing reactions
    let reactions: { [key: string]: string[] } = {};
    try {
      reactions = comment.reactions ? JSON.parse(comment.reactions) : {};
    } catch (error) {
      reactions = {};
    }

    // Toggle reaction: if user already reacted with this emoji, remove it; otherwise add it
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    const userIndex = reactions[emoji].indexOf(userId);
    if (userIndex > -1) {
      // Remove reaction
      reactions[emoji].splice(userIndex, 1);
      // If no users left for this emoji, remove the emoji key
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      // Add reaction
      reactions[emoji].push(userId);
    }

    // Update comment with new reactions
    const updatedRow = await queryOne<any>(
      `UPDATE "Comment"
       SET reactions = $1, "updatedAt" = $2
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(reactions), new Date(), id]
    );

    // Fetch user info
    const userRow = await queryOne<any>(
      `SELECT id, "displayName", email FROM "User" WHERE id = $1`,
      [updatedRow.userId]
    );

    const updatedComment = {
      ...updatedRow,
      User: userRow
        ? { id: userRow.id, displayName: userRow.displayName, email: userRow.email }
        : null,
    };

    res.json(updatedComment);
  } catch (error: any) {
    errorLogger.error('Toggle reaction error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
