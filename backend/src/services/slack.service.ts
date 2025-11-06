import { slackClient, slackConfig } from '../config/slack';
import prisma from '../config/database';
import { randomUUID } from 'crypto';

export interface SlackNotificationPayload {
  channel?: string;
  message: string;
  itemId?: string;
  blocks?: any[];
}

class SlackNotificationService {
  async sendNotification(payload: SlackNotificationPayload): Promise<boolean> {
    try {
      const channel = payload.channel || slackConfig.defaultChannel;

      const result = await slackClient.chat.postMessage({
        channel,
        text: payload.message,
        blocks: payload.blocks,
      });

      await prisma.slackNotification.create({
        data: {
          id: randomUUID(),
          channel,
          message: payload.message,
          itemId: payload.itemId,
          success: true,
        },
      });

      return !!result.ok;
    } catch (error: any) {
      console.error('Slack notification error:', error);

      await prisma.slackNotification.create({
        data: {
          id: randomUUID(),
          channel: payload.channel || slackConfig.defaultChannel,
          message: payload.message,
          itemId: payload.itemId,
          success: false,
          error: error.message,
        },
      });

      return false;
    }
  }

  async notifyItemCreated(itemType: string, itemName: string, assigneeName: string) {
    const message = `🆕 새로운 ${itemType}이 생성되었습니다: *${itemName}*\n담당자: ${assigneeName}`;
    return this.sendNotification({ message });
  }

  async notifyItemStatusChanged(itemType: string, itemName: string, oldStatus: string, newStatus: string) {
    const message = `🔄 ${itemType} 상태 변경: *${itemName}*\n${oldStatus} → ${newStatus}`;
    return this.sendNotification({ message });
  }

  async notifyItemCompleted(itemType: string, itemName: string, assigneeName: string) {
    const message = `✅ ${itemType} 완료: *${itemName}*\n담당자: ${assigneeName}`;
    return this.sendNotification({ message });
  }

  async notifyDeadlineApproaching(itemType: string, itemName: string, daysLeft: number) {
    const message = `⚠️ 마감일 임박: *${itemName}*\n${daysLeft}일 남음`;
    return this.sendNotification({ message });
  }
}

export default new SlackNotificationService();