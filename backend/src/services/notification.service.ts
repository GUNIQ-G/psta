import crypto from 'crypto';
import prisma from '../config/database';
import { NotificationSlackService } from './notification-slack.service';

interface CreateNotificationParams {
  type: string;
  content: string;
  itemId?: string;
  commentId?: string;
  fromUserId: string;
  toUserId: string;
  link?: string;
  extraContent?: string; // 댓글 내용, 메시지 본문 등
}

/**
 * 통합 알림 서비스
 * 알림 생성 시 자동으로 Slack으로도 전송
 */
export class NotificationService {
  /**
   * 알림 생성 및 Slack 전송
   */
  public static async createNotification(params: CreateNotificationParams): Promise<void> {
    const { type, content, itemId, commentId, fromUserId, toUserId, link, extraContent } = params;

    try {
      // 1. 데이터베이스에 알림 생성
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          type,
          content,
          itemId,
          commentId,
          fromUserId,
          toUserId,
        },
      });

      // 2. 수신자 정보 가져오기
      const [fromUser, toUser] = await Promise.all([
        prisma.user.findUnique({
          where: { id: fromUserId },
          select: { email: true },
        }),
        prisma.user.findUnique({
          where: { id: toUserId },
          select: { email: true },
        }),
      ]);

      // 3. Slack 알림 전송 (비동기, 실패해도 메인 로직에 영향 없음)
      if (toUser?.email) {
        NotificationSlackService.sendNotification({
          type,
          content,
          itemId,
          commentId,
          fromUserEmail: fromUser?.email,
          toUserEmail: toUser.email,
          link,
          extraContent,
        }).catch(err => {
          console.error('Failed to send Slack notification:', err);
        });
      }
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * 여러 사용자에게 동일한 알림 전송
   */
  public static async createBulkNotifications(
    params: Omit<CreateNotificationParams, 'toUserId'>,
    toUserIds: string[]
  ): Promise<void> {
    const promises = toUserIds.map(toUserId =>
      this.createNotification({ ...params, toUserId })
    );

    await Promise.all(promises);
  }

  /**
   * 업무 할당 알림
   */
  public static async notifyItemAssigned(params: {
    itemId: string;
    itemName: string;
    assigneeId: string;
    assignedById: string;
  }): Promise<void> {
    await this.createNotification({
      type: 'item_assigned',
      content: `"${params.itemName}" 업무가 할당되었습니다.`,
      itemId: params.itemId,
      fromUserId: params.assignedById,
      toUserId: params.assigneeId,
    });
  }

  /**
   * 상태 변경 알림
   */
  public static async notifyStatusChanged(params: {
    itemId: string;
    itemName: string;
    oldStatus: string;
    newStatus: string;
    assigneeId: string;
    changedById: string;
  }): Promise<void> {
    if (params.assigneeId === params.changedById) {
      return; // 자기 자신이 변경한 경우 알림 안 함
    }

    const statusLabels: { [key: string]: string } = {
      NOT_STARTED: '시작 전',
      IN_PROGRESS: '진행중',
      COMPLETED: '완료',
      ON_HOLD: '보류',
    };

    const oldLabel = statusLabels[params.oldStatus] || params.oldStatus;
    const newLabel = statusLabels[params.newStatus] || params.newStatus;

    await this.createNotification({
      type: 'item_status_changed',
      content: `"${params.itemName}" 상태가 "${oldLabel}"에서 "${newLabel}"로 변경되었습니다.`,
      itemId: params.itemId,
      fromUserId: params.changedById,
      toUserId: params.assigneeId,
    });
  }

  /**
   * 업무 완료 알림
   */
  public static async notifyItemCompleted(params: {
    itemId: string;
    itemName: string;
    completedById: string;
    notifyUserIds: string[];
  }): Promise<void> {
    await this.createBulkNotifications(
      {
        type: 'item_completed',
        content: `"${params.itemName}" 업무가 완료되었습니다.`,
        itemId: params.itemId,
        fromUserId: params.completedById,
      },
      params.notifyUserIds.filter(id => id !== params.completedById)
    );
  }

  /**
   * 마감 임박 알림
   */
  public static async notifyDeadlineApproaching(params: {
    itemId: string;
    itemName: string;
    deadline: Date;
    assigneeId: string;
    systemUserId: string;
  }): Promise<void> {
    const daysLeft = Math.ceil(
      (params.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    await this.createNotification({
      type: 'deadline_approaching',
      content: `"${params.itemName}" 마감이 ${daysLeft}일 남았습니다.`,
      itemId: params.itemId,
      fromUserId: params.systemUserId,
      toUserId: params.assigneeId,
    });
  }

  /**
   * 작업 요청 생성 알림
   */
  public static async notifyWorkRequestCreated(params: {
    workRequestId: string;
    title: string;
    requesterId: string;
    assigneeId?: string;
    assigneeTeamId?: string;
  }): Promise<void> {
    // 개인 할당된 경우
    if (params.assigneeId) {
      await this.createNotification({
        type: 'work_request_created',
        content: `새로운 작업 요청 "${params.title}"이(가) 할당되었습니다.`,
        itemId: params.workRequestId, // workRequestId를 itemId에 저장
        fromUserId: params.requesterId,
        toUserId: params.assigneeId,
        link: `/requests?workRequestId=${params.workRequestId}`,
      });
      return;
    }

    // 팀 할당된 경우
    if (params.assigneeTeamId) {
      const teamMembers = await prisma.user.findMany({
        where: {
          teamId: params.assigneeTeamId,
          isVerified: true,
        },
        select: { id: true },
      });

      await this.createBulkNotifications(
        {
          type: 'work_request_created',
          content: `새로운 작업 요청 "${params.title}"이(가) 팀에 할당되었습니다.`,
          itemId: params.workRequestId, // workRequestId를 itemId에 저장
          fromUserId: params.requesterId,
          link: `/requests?workRequestId=${params.workRequestId}`,
        },
        teamMembers.map(m => m.id).filter(id => id !== params.requesterId)
      );
    }
  }

  /**
   * 작업 요청 승인 알림
   */
  public static async notifyWorkRequestApproved(params: {
    workRequestId: string;
    title: string;
    requesterId: string;
    approvedById: string;
  }): Promise<void> {
    await this.createNotification({
      type: 'work_request_approved',
      content: `작업 요청 "${params.title}"이(가) 승인되었습니다.`,
      itemId: params.workRequestId,
      fromUserId: params.approvedById,
      toUserId: params.requesterId,
      link: `/requests?workRequestId=${params.workRequestId}`,
    });
  }

  /**
   * 작업 요청 반려 알림
   */
  public static async notifyWorkRequestRejected(params: {
    workRequestId: string;
    title: string;
    requesterId: string;
    rejectedById: string;
    rejectionMessage?: string;
  }): Promise<void> {
    await this.createNotification({
      type: 'work_request_rejected',
      content: `작업 요청 "${params.title}"이(가) 반려되었습니다.`,
      itemId: params.workRequestId,
      fromUserId: params.rejectedById,
      toUserId: params.requesterId,
      link: `/requests?workRequestId=${params.workRequestId}`,
      extraContent: params.rejectionMessage,
    });
  }

  /**
   * 작업 요청 협의 알림
   */
  public static async notifyWorkRequestNegotiation(params: {
    workRequestId: string;
    title: string;
    requesterId: string;
    negotiatedById: string;
    negotiationMessage: string;
  }): Promise<void> {
    await this.createNotification({
      type: 'work_request_negotiation',
      content: `작업 요청 "${params.title}"에 대한 협의 요청이 있습니다.`,
      itemId: params.workRequestId,
      fromUserId: params.negotiatedById,
      toUserId: params.requesterId,
      link: `/requests?workRequestId=${params.workRequestId}`,
      extraContent: params.negotiationMessage,
    });
  }

  /**
   * 작업 요청 재요청 알림
   */
  public static async notifyWorkRequestResubmitted(params: {
    workRequestId: string;
    title: string;
    requesterId: string;
    assigneeId?: string;
    assigneeTeamId?: string;
  }): Promise<void> {
    // 개인 할당된 경우
    if (params.assigneeId) {
      await this.createNotification({
        type: 'work_request_resubmitted',
        content: `작업 요청 "${params.title}"이(가) 재요청되었습니다.`,
        itemId: params.workRequestId,
        fromUserId: params.requesterId,
        toUserId: params.assigneeId,
        link: `/requests?workRequestId=${params.workRequestId}`,
      });
      return;
    }

    // 팀 할당된 경우
    if (params.assigneeTeamId) {
      const teamMembers = await prisma.user.findMany({
        where: {
          teamId: params.assigneeTeamId,
          isVerified: true,
        },
        select: { id: true },
      });

      await this.createBulkNotifications(
        {
          type: 'work_request_resubmitted',
          content: `작업 요청 "${params.title}"이(가) 재요청되었습니다.`,
          itemId: params.workRequestId,
          fromUserId: params.requesterId,
          link: `/requests?workRequestId=${params.workRequestId}`,
        },
        teamMembers.map(m => m.id).filter(id => id !== params.requesterId)
      );
    }
  }

  /**
   * 작업 요청 개인 할당 알림
   */
  public static async notifyWorkRequestAssigned(params: {
    workRequestId: string;
    title: string;
    assigneeId: string;
    assignedById: string;
  }): Promise<void> {
    await this.createNotification({
      type: 'work_request_assigned',
      content: `작업 요청 "${params.title}"이(가) 회원님에게 할당되었습니다.`,
      itemId: params.workRequestId,
      fromUserId: params.assignedById,
      toUserId: params.assigneeId,
      link: `/requests?workRequestId=${params.workRequestId}`,
    });
  }
}
