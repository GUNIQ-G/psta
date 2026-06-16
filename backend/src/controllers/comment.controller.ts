import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import crypto from 'crypto';
import { NotificationService } from '../services/notification.service';
import appLogger, { errorLogger } from '../config/logger';

export const getCommentsByItem = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { itemId } = req.params;

    const comments = await prisma.comment.findMany({
      where: { itemId },
      include: {
        User: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich reactions with user information
    const enrichedComments = await Promise.all(
      comments.map(async (comment) => {
        let reactionsWithUsers = {};
        try {
          if (comment.reactions) {
            const reactions = JSON.parse(comment.reactions);

            // Get all unique user IDs from reactions
            const allUserIds = new Set<string>();
            Object.values(reactions).forEach((userIds: any) => {
              userIds.forEach((id: string) => allUserIds.add(id));
            });

            // Fetch user info for all users who reacted
            const users = await prisma.user.findMany({
              where: { id: { in: Array.from(allUserIds) } },
              select: {
                id: true,
                displayName: true,
              },
            });

            const userMap = new Map(users.map(u => [u.id, u.displayName]));

            // Map reactions to include user names
            reactionsWithUsers = Object.entries(reactions).reduce((acc, [emoji, userIds]) => {
              acc[emoji] = (userIds as string[]).map(userId => ({
                userId,
                displayName: userMap.get(userId) || '알 수 없음',
              }));
              return acc;
            }, {} as any);
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

    const comment = await prisma.comment.create({
      data: {
        id: crypto.randomUUID(),
        content,
        itemId,
        userId,
        updatedAt: new Date(),
      },
      include: {
        User: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

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
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        User_Item_assigneeIdToUser: {
          select: {
            displayName: true,
          },
        },
      },
    });

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
      const assigneeName = item?.User_Item_assigneeIdToUser?.displayName || '미배정';
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

      const messageContent = `${content}\n\n━━━━━━━━━━━━━━━━━━━━\n[ITEM_INFO]${typeLabel}|${statusLabel}|${item?.name || '항목'}|${assigneeName}|${dateRange}|${progress}[/ITEM_INFO]\n[LINK]${process.env.FRONTEND_URL || 'http://192.168.1.250:3000'}/psta?itemId=${itemId}[/LINK]`;

      await prisma.message.create({
        data: {
          id: crypto.randomUUID(),
          subject: `[멘션 알림] (${typeLabel}) ${item?.name || '항목'}`,
          content: messageContent,
          fromUserId: userId,
          toUserId,
        },
      });
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
    const comment = await prisma.comment.findUnique({ where: { id } });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await prisma.comment.delete({ where: { id } });

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

    const comment = await prisma.comment.findUnique({ where: { id } });

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
    const updatedComment = await prisma.comment.update({
      where: { id },
      data: {
        reactions: JSON.stringify(reactions),
        updatedAt: new Date(),
      },
      include: {
        User: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    res.json(updatedComment);
  } catch (error: any) {
    errorLogger.error('Toggle reaction error:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
