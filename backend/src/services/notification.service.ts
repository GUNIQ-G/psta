import crypto from 'crypto';
import { query, queryOne } from '../config/database';
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
      await query(
        `INSERT INTO "Notification" ("id", "type", "content", "itemId", "commentId", "fromUserId", "toUserId")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [crypto.randomUUID(), type, content, itemId ?? null, commentId ?? null, fromUserId, toUserId]
      );

      // 2. 수신자 정보 가져오기
      const [fromUser, toUser] = await Promise.all([
        queryOne<{ email: string }>(
          `SELECT "email" FROM "User" WHERE id = $1`,
          [fromUserId]
        ),
        queryOne<{ email: string }>(
          `SELECT "email" FROM "User" WHERE id = $1`,
          [toUserId]
        ),
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
      const teamMembers = await query<{ id: string }>(
        `SELECT "id" FROM "User" WHERE "teamId" = $1 AND "isVerified" = true`,
        [params.assigneeTeamId]
      );

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
      const teamMembers = await query<{ id: string }>(
        `SELECT "id" FROM "User" WHERE "teamId" = $1 AND "isVerified" = true`,
        [params.assigneeTeamId]
      );

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

  /**
   * 계층 생성 요청 알림 (서비스/팀 생성 필요)
   */
  public static async notifyHierarchyRequest(params: {
    workRequestId: string;
    requestType: string;
    targetItemType: string;
    requesterId: string;
    assigneeId: string;
    parentWorkRequestId: string;
    projectName?: string;
    serviceName?: string;
  }): Promise<void> {
    const itemTypeKo = params.targetItemType === 'SERVICE' ? '서비스' : '팀';
    const contextName = params.targetItemType === 'SERVICE'
      ? params.projectName || '프로젝트'
      : params.serviceName || '서비스';

    await this.createNotification({
      type: 'hierarchy_request',
      content: `[자동] ${contextName} - ${itemTypeKo} 생성이 요청되었습니다.`,
      itemId: params.workRequestId,
      fromUserId: params.requesterId,
      toUserId: params.assigneeId,
      link: `/requests?workRequestId=${params.workRequestId}`,
      extraContent: `연결된 작업 요청: #${params.parentWorkRequestId.substring(0, 8)}`,
    });
  }

  /**
   * 계층 생성 완료 알림 (서비스/팀 생성됨)
   */
  public static async notifyHierarchyCreated(params: {
    itemType: string;
    itemName: string;
    originalRequesterId: string;
    originalWorkRequestId: string;
    createdById: string;
  }): Promise<void> {
    const itemTypeKo = params.itemType === 'SERVICE' ? '서비스' : '팀';
    const nextStep = params.itemType === 'SERVICE'
      ? '다음 단계: 팀 선택이 필요할 수 있습니다.'
      : '이제 액션을 생성할 수 있습니다.';

    await this.createNotification({
      type: 'hierarchy_created',
      content: `${itemTypeKo} "${params.itemName}"이(가) 생성되었습니다. ${nextStep}`,
      itemId: params.originalWorkRequestId,
      fromUserId: params.createdById,
      toUserId: params.originalRequesterId,
      link: `/requests?workRequestId=${params.originalWorkRequestId}`,
    });
  }

  /**
   * 미정 액션 생성 알림 (팀장에게)
   * 미정 프로젝트 또는 미정 서비스에 액션이 생성되었을 때 팀장에게 알림
   */
  public static async notifyUndecidedActionCreated(params: {
    actionId: string;
    actionName: string;
    isProjectUndecided: boolean;
    isServiceUndecided: boolean;
    createdById: string;
    teamId: string;
  }): Promise<void> {
    // 팀장 찾기: positionType이 TEAM_LEADER 또는 PART_LEADER, 또는 role이 PM/PO인 사용자
    const teamLeaders = await query<{ id: string }>(
      `SELECT "id" FROM "User"
       WHERE "teamId" = $1
         AND "isVerified" = true
         AND "isActive" = true
         AND (
           "positionType" IN ('TEAM_LEADER', 'PART_LEADER')
           OR "role" IN ('PM', 'PO')
         )`,
      [params.teamId]
    );

    // 팀장이 없으면 ADMIN에게 알림
    let notifyUserIds = teamLeaders.map(u => u.id);
    if (notifyUserIds.length === 0) {
      const admins = await query<{ id: string }>(
        `SELECT "id" FROM "User"
         WHERE "role" = 'ADMIN'
           AND "isVerified" = true
           AND "isActive" = true`,
        []
      );
      notifyUserIds = admins.map(u => u.id);
    }

    // 생성자는 알림에서 제외
    notifyUserIds = notifyUserIds.filter(id => id !== params.createdById);

    if (notifyUserIds.length === 0) return;

    // 미정 유형 메시지 생성
    const undecidedTypes: string[] = [];
    if (params.isProjectUndecided) undecidedTypes.push('프로젝트');
    if (params.isServiceUndecided) undecidedTypes.push('서비스');
    const undecidedMessage = undecidedTypes.join(', ') + '가 미정';

    await this.createBulkNotifications(
      {
        type: 'undecided_action_created',
        content: `[미정 액션] "${params.actionName}" - ${undecidedMessage}입니다. 확인이 필요합니다.`,
        itemId: params.actionId,
        fromUserId: params.createdById,
        link: `/actions`,
      },
      notifyUserIds
    );
  }
}
