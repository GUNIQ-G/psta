import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearWorkRequestNotifications() {
  try {
    console.log('작업 요청 관련 알림 삭제 중...');

    // 작업 요청 관련 알림 타입들
    const workRequestTypes = [
      'work_request_created',
      'work_request_approved',
      'work_request_rejected',
      'work_request_negotiation',
      'work_request_resubmitted',
      'work_request_assigned',
    ];

    const result = await prisma.notification.deleteMany({
      where: {
        type: {
          in: workRequestTypes,
        },
      },
    });

    console.log(`✅ 작업 요청 알림 ${result.count}개 삭제 완료`);
  } catch (error) {
    console.error('❌ 알림 삭제 실패:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearWorkRequestNotifications();
