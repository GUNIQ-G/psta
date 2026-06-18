import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { randomUUID } from 'crypto';
import { FeedbackStatus, FeedbackType, UserRole } from '@prisma/client';
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
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (type && type !== 'ALL') {
      where.type = type as FeedbackType;
    }

    if (status && status !== 'ALL') {
      where.status = status as FeedbackStatus;
    }

    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          CreatedBy: {
            select: {
              id: true,
              displayName: true,
              username: true,
              Team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          ResolvedBy: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.feedback.count({ where }),
    ]);

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

    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: {
        CreatedBy: {
          select: {
            id: true,
            displayName: true,
            username: true,
            Team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        ResolvedBy: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    if (!feedback) {
      return res.status(404).json({ error: 'Not found' });
    }

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

    const feedback = await prisma.feedback.create({
      data: {
        id: randomUUID(),
        title,
        content,
        type: type as FeedbackType,
        createdById: userId,
        updatedAt: new Date(),
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            displayName: true,
            username: true,
            Team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

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

    const feedback = await prisma.feedback.findUnique({
      where: { id },
    });

    if (!feedback) {
      return res.status(404).json({ error: 'Not found' });
    }

    const isAdmin = userRole === UserRole.ADMIN;
    const isAuthor = feedback.createdById === userId;

    // Build update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Author can update title/content only if status is PENDING
    if (isAuthor && feedback.status === FeedbackStatus.PENDING) {
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
    }

    // Admin can update status and adminComment
    if (isAdmin) {
      if (status !== undefined) {
        updateData.status = status as FeedbackStatus;

        // Set resolvedAt and resolvedById when resolved or rejected
        if (status === FeedbackStatus.RESOLVED || status === FeedbackStatus.REJECTED) {
          updateData.resolvedAt = new Date();
          updateData.resolvedById = userId;
        } else {
          updateData.resolvedAt = null;
          updateData.resolvedById = null;
        }
      }
      if (adminComment !== undefined) updateData.adminComment = adminComment;
    }

    // Check if user has permission to update
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: 'You do not have permission to update this feedback' });
    }

    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: updateData,
      include: {
        CreatedBy: {
          select: {
            id: true,
            displayName: true,
            username: true,
            Team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        ResolvedBy: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    res.json(updatedFeedback);
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

    const feedback = await prisma.feedback.findUnique({
      where: { id },
    });

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

    await prisma.feedback.delete({
      where: { id },
    });

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
    const [total, pending, inProgress, resolved, rejected, byType] = await Promise.all([
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: FeedbackStatus.PENDING } }),
      prisma.feedback.count({ where: { status: FeedbackStatus.IN_PROGRESS } }),
      prisma.feedback.count({ where: { status: FeedbackStatus.RESOLVED } }),
      prisma.feedback.count({ where: { status: FeedbackStatus.REJECTED } }),
      prisma.feedback.groupBy({
        by: ['type'],
        _count: true,
      }),
    ]);

    const typeStats = {
      BUG: 0,
      FEATURE: 0,
      IMPROVEMENT: 0,
    };

    byType.forEach((item) => {
      typeStats[item.type] = item._count;
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
