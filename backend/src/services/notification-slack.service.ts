import { WebClient } from '@slack/web-api';
import { query, queryOne } from '../config/database';

interface SlackConfig {
  botToken: string;
  userToken?: string;
  appId?: string;
  clientId?: string;
  clientSecret?: string;
  signingSecret?: string;
  verificationToken?: string;
}

interface NotificationData {
  type: string;
  content: string;
  itemId?: string;
  commentId?: string;
  fromUserEmail?: string;
  toUserEmail: string;
  link?: string;
  extraContent?: string; // 댓글 내용, 메시지 본문 등 추가 내용
}

/**
 * Slack 알림 전송 서비스
 * NotificationApp 설정을 사용하여 Slack DM 전송
 */
export class NotificationSlackService {
  /**
   * 활성화된 Slack 설정 가져오기
   */
  private static async getActiveSlackConfig(): Promise<SlackConfig | null> {
    try {
      const app = await queryOne<{ config: string }>(
        `SELECT "config" FROM "NotificationApp" WHERE "type" = 'SLACK' AND "isActive" = true LIMIT 1`
      );

      if (!app) {
        console.log('No active Slack app found');
        return null;
      }

      const config = JSON.parse(app.config) as SlackConfig;
      return config;
    } catch (error) {
      console.error('Failed to get Slack config:', error);
      return null;
    }
  }

  /**
   * 페이지 링크 생성
   */
  private static async generateLink(data: NotificationData): Promise<string | null> {
    // Get frontend URL from system settings
    let baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    try {
      const frontendUrlSetting = await queryOne<{ value: string }>(
        `SELECT "value" FROM "SystemSetting" WHERE "key" = $1`,
        ['frontendUrl']
      );

      if (frontendUrlSetting?.value) {
        baseUrl = frontendUrlSetting.value;
      }
    } catch (error) {
      console.error('Failed to load frontendUrl from settings, using default:', error);
    }

    // 알림 타입에 따라 링크 생성
    if (data.itemId) {
      // 아이템 관련 알림 -> PSTA 페이지
      return `${baseUrl}/psta?itemId=${data.itemId}`;
    }

    if (data.commentId) {
      // 댓글 관련 알림 -> PSTA 페이지 (코멘트로 스크롤)
      return `${baseUrl}/psta?commentId=${data.commentId}`;
    }

    // 커스텀 링크가 제공된 경우
    if (data.link) {
      return data.link.startsWith('http') ? data.link : `${baseUrl}${data.link}`;
    }

    return null;
  }

  /**
   * Slack 메시지 포맷 생성 (Block Kit 사용)
   */
  private static formatSlackMessage(data: NotificationData, link: string | null) {
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📬 새로운 알림',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*알림 유형:*\n${this.getNotificationTypeLabel(data.type)}`,
          },
          {
            type: 'mrkdwn',
            text: `*보낸 사람:*\n${data.fromUserEmail || '시스템'}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*알림:*\n${data.content}`,
        },
      },
    ];

    // 추가 내용이 있으면 표시 (댓글, 메시지 본문 등)
    if (data.extraContent) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*내용:*\n${this.formatExtraContent(data.extraContent)}`,
        },
      });
    }

    // 링크가 있으면 버튼 추가
    if (link) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔗 바로가기',
              emoji: true,
            },
            url: link,
            style: 'primary',
          },
        ],
      });
    }

    // Footer
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '📊 *PSTA 시스템*',
        },
      ],
    });

    return {
      blocks,
      text: `새로운 알림: ${data.content}`, // Fallback text
    };
  }

  /**
   * 추가 내용 포맷팅 (멘션 제거, 길이 제한)
   */
  private static formatExtraContent(content: string): string {
    // 멘션 형식 제거: @[displayName](userId) -> @displayName
    let formatted = content.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');

    // 너무 길면 자르기 (500자 제한)
    if (formatted.length > 500) {
      formatted = formatted.substring(0, 497) + '...';
    }

    // 백틱으로 감싸서 코드 블록 스타일로 표시
    return `\`\`\`${formatted}\`\`\``;
  }

  /**
   * 알림 유형 라벨 변환
   */
  private static getNotificationTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      comment_mention: '💬 댓글 멘션',
      comment_reply: '↩️ 댓글 답글',
      item_assigned: '📌 업무 할당',
      item_status_changed: '🔄 상태 변경',
      item_completed: '✅ 업무 완료',
      deadline_approaching: '⏰ 마감 임박',
      message_received: '✉️ 메시지 수신',
      work_request_created: '📝 작업 요청 생성',
      work_request_approved: '✅ 작업 요청 승인',
      work_request_rejected: '❌ 작업 요청 반려',
      work_request_negotiation: '💬 작업 요청 협의',
      work_request_resubmitted: '🔄 작업 요청 재요청',
      work_request_assigned: '👤 작업 담당자 할당',
      system: '🔔 시스템',
    };

    return labels[type] || '📬 알림';
  }

  /**
   * Slack DM 전송
   */
  public static async sendNotification(data: NotificationData): Promise<boolean> {
    try {
      // 1. 활성화된 Slack 설정 가져오기
      const config = await this.getActiveSlackConfig();
      if (!config || !config.botToken) {
        console.log('Slack not configured, skipping notification');
        return false;
      }

      // 2. Slack 클라이언트 초기화
      const client = new WebClient(config.botToken);

      // 3. 이메일로 사용자 조회
      const userResult = await client.users.lookupByEmail({
        email: data.toUserEmail,
      });

      if (!userResult.ok || !userResult.user) {
        console.log(`User not found in Slack: ${data.toUserEmail}`);
        return false;
      }

      const userId = userResult.user.id as string;

      // 4. DM 채널 열기
      const dmChannel = await client.conversations.open({
        users: userId,
      });

      if (!dmChannel.ok || !dmChannel.channel) {
        console.error('Failed to open DM channel');
        return false;
      }

      // 5. 링크 생성
      const link = await this.generateLink(data);

      // 6. 메시지 포맷 생성
      const message = this.formatSlackMessage(data, link);

      // 7. 메시지 전송
      const result = await client.chat.postMessage({
        channel: dmChannel.channel.id as string,
        ...message,
      });

      if (result.ok) {
        console.log(`✅ Slack notification sent to ${data.toUserEmail}`);
        return true;
      } else {
        console.error('Failed to send Slack message:', result);
        return false;
      }
    } catch (error: any) {
      console.error('Slack notification error:', error.message);
      return false;
    }
  }

  /**
   * 여러 사용자에게 동시에 알림 전송
   */
  public static async sendBulkNotifications(
    notifications: NotificationData[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const notification of notifications) {
      const sent = await this.sendNotification(notification);
      if (sent) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }
}
