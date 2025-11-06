import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;
    const { unreadOnly } = req.query;

    // 7일 전 날짜 계산
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const notifications = await prisma.notification.findMany({
      where: {
        toUserId: userId,
        ...(unreadOnly === 'true' ? { isRead: false } : {}),
        OR: [
          // 읽지 않은 알림은 날짜 제한 없음
          { isRead: false },
          // 읽은 알림은 7일 이내만
          {
            isRead: true,
            createdAt: {
              gte: sevenDaysAgo,
            },
          },
        ],
      },
      include: {
        FromUser: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(notifications);
  } catch (error: any) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;

    const count = await prisma.notification.count({
      where: {
        toUserId: userId,
        isRead: false,
      },
    });

    res.json({ count });
  } catch (error: any) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.toUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ message: 'Marked as read' });
  } catch (error: any) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: {
        toUserId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ message: 'All marked as read' });
  } catch (error: any) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: error.message });
  }
};
