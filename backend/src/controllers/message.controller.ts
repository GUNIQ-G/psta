import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { randomUUID } from 'crypto';
import { NotificationService } from '../services/notification.service';

// 받은 메시지 목록 조회
export const getReceivedMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { unreadOnly } = req.query;

    const where: any = { toUserId: userId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        FromUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 보낸 메시지 목록 조회
export const getSentMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const messages = await prisma.message.findMany({
      where: { fromUserId: userId },
      include: {
        ToUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 메시지 상세 조회
export const getMessageById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        FromUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
        ToUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 권한 체크: 발신자 또는 수신자만 볼 수 있음
    if (message.fromUserId !== userId && message.toUserId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 수신자가 읽을 경우 읽음 처리
    if (message.toUserId === userId && !message.isRead) {
      await prisma.message.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date()
        },
      });
      message.isRead = true;
    }

    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
    const toUser = await prisma.user.findUnique({
      where: { id: toUserId },
    });

    if (!toUser) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const message = await prisma.message.create({
      data: {
        id: randomUUID(),
        fromUserId,
        toUserId,
        subject,
        content,
      },
      include: {
        FromUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
        ToUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    // 알림 생성 및 Slack 전송
    await NotificationService.createNotification({
      type: 'message_received',
      content: `${message.FromUser.displayName}님이 메시지를 보냈습니다: "${subject}"`,
      fromUserId,
      toUserId,
      link: '/messages',
      extraContent: content, // 메시지 내용 포함
    }).catch(err => {
      console.error('Failed to send message notification:', err);
      // 알림 실패해도 메시지 전송은 성공으로 처리
    });

    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 읽지 않은 메시지 개수 조회
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const count = await prisma.message.count({
      where: {
        toUserId: userId,
        isRead: false,
      },
    });

    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 메시지 읽음 처리
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 수신자만 읽음 처리 가능
    if (message.toUserId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date()
      },
    });

    res.json(updatedMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 메시지 삭제
export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 발신자 또는 수신자만 삭제 가능
    if (message.fromUserId !== userId && message.toUserId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.message.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
