import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { NotificationService } from './notification.service';

export const extractDescriptionMentionIds = (html: string | null | undefined): string[] => {
  if (!html) return [];
  const ids: string[] = [];
  const regex = /data-type="mention"[^>]*data-id="([^"]+)"|data-id="([^"]+)"[^>]*data-type="mention"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    ids.push(match[1] || match[2]);
  }
  return [...new Set(ids)];
};

export const sendDescriptionMentionNotifications = async (
  itemId: string,
  itemName: string,
  fromUserId: string,
  newMentionIds: string[],
  updatedMentionIds: string[],
): Promise<void> => {
  const typeLabels: { [key: string]: string } = {
    PROJECT: '프로젝트', SERVICE: '서비스', TEAM: '팀', ACTION: '액션',
  };

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { type: true },
  });
  const typeLabel = item?.type ? typeLabels[item.type] : '항목';

  const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/psta?itemId=${itemId}`;
  const messageBase = `[LINK]${link}[/LINK]`;

  for (const toUserId of newMentionIds) {
    if (toUserId === fromUserId) continue;
    await NotificationService.createNotification({
      type: 'description_mention',
      content: `설명에서 멘션되었습니다: (${typeLabel}) ${itemName}`,
      itemId,
      fromUserId,
      toUserId,
    });
    await prisma.message.create({
      data: {
        id: randomUUID(),
        subject: `[멘션 알림] (${typeLabel}) ${itemName}`,
        content: `설명에서 회원님을 멘션했습니다.\n\n${messageBase}`,
        fromUserId,
        toUserId,
      },
    });
  }

  for (const toUserId of updatedMentionIds) {
    if (toUserId === fromUserId) continue;
    await NotificationService.createNotification({
      type: 'description_mention',
      content: `멘션된 설명이 수정되었습니다: (${typeLabel}) ${itemName}`,
      itemId,
      fromUserId,
      toUserId,
    });
    await prisma.message.create({
      data: {
        id: randomUUID(),
        subject: `[설명 수정 알림] (${typeLabel}) ${itemName}`,
        content: `멘션된 설명이 수정되었습니다.\n\n${messageBase}`,
        fromUserId,
        toUserId,
      },
    });
  }
};
