import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 미정 항목 UUID (시스템 기본 항목으로 보호됨)
const UNASSIGNED_PROJECT_ID = 'f9c9f2d2-6e0c-4e63-838d-e0a4c5ad4de7';
const UNASSIGNED_SERVICE_ID = 'caeb1542-73bf-4edb-b7c5-073a97771ff1';

async function clearAllPstaData() {
  try {
    console.log('='.repeat(50));
    console.log('PSTA 데이터 초기화 시작...');
    console.log('='.repeat(50));
    console.log('ℹ️  미정 프로젝트/서비스는 보호됩니다.\n');

    // 1. 파일 삭제 (Item에 연결된 파일)
    console.log('\n1️⃣  파일 삭제 중...');
    const filesResult = await prisma.file.deleteMany({});
    console.log(`   ✅ 파일 ${filesResult.count}개 삭제 완료`);

    // 2. 댓글 삭제 (Comment)
    console.log('\n2️⃣  댓글 삭제 중...');
    const commentsResult = await prisma.comment.deleteMany({});
    console.log(`   ✅ 댓글 ${commentsResult.count}개 삭제 완료`);

    // 3. 모든 알림 삭제 (Notification)
    console.log('\n3️⃣  모든 사용자 알림 삭제 중...');
    const notificationsResult = await prisma.notification.deleteMany({});
    console.log(`   ✅ 알림 ${notificationsResult.count}개 삭제 완료`);

    // 4. 작업 요청 삭제 (WorkRequest - actionId가 있는 경우 먼저 해제)
    console.log('\n4️⃣  작업 요청 삭제 중...');
    const workRequestsResult = await prisma.workRequest.deleteMany({});
    console.log(`   ✅ 작업 요청 ${workRequestsResult.count}개 삭제 완료`);

    // 5. Item 삭제 (PROJECT, SERVICE, TEAM, ACTION 모두 포함)
    console.log('\n5️⃣  Item 데이터 삭제 중...');
    
    // 5-1. ACTION 삭제 (미정 서비스의 하위 항목 제외)
    const actionsResult = await prisma.item.deleteMany({
      where: {
        type: 'ACTION',
        // 미정 서비스의 자식이 아닌 항목만 삭제
        parentId: {
          not: UNASSIGNED_SERVICE_ID,
        },
      },
    });
    console.log(`   ✅ ACTION ${actionsResult.count}개 삭제 완료 (미정 항목 제외)`);

    // 5-2. TEAM 삭제 (미정 서비스의 하위 항목 제외)
    const teamsResult = await prisma.item.deleteMany({
      where: {
        type: 'TEAM',
        parentId: {
          not: UNASSIGNED_SERVICE_ID,
        },
      },
    });
    console.log(`   ✅ TEAM ${teamsResult.count}개 삭제 완료 (미정 항목 제외)`);

    // 5-3. SERVICE 삭제 (미정 서비스 제외)
    const servicesResult = await prisma.item.deleteMany({
      where: {
        type: 'SERVICE',
        id: {
          not: UNASSIGNED_SERVICE_ID,
        },
      },
    });
    console.log(`   ✅ SERVICE ${servicesResult.count}개 삭제 완료 (미정 서비스 제외)`);

    // 5-4. PROJECT 삭제 (미정 프로젝트 제외)
    const projectsResult = await prisma.item.deleteMany({
      where: {
        type: 'PROJECT',
        id: {
          not: UNASSIGNED_PROJECT_ID,
        },
      },
    });
    console.log(`   ✅ PROJECT ${projectsResult.count}개 삭제 완료 (미정 프로젝트 제외)`);

    console.log('\n' + '='.repeat(50));
    console.log('📊 초기화 완료 요약:');
    console.log('='.repeat(50));
    console.log(`   파일:         ${filesResult.count}개`);
    console.log(`   댓글:         ${commentsResult.count}개`);
    console.log(`   알림:         ${notificationsResult.count}개`);
    console.log(`   작업 요청:    ${workRequestsResult.count}개`);
    console.log(`   ACTION:       ${actionsResult.count}개`);
    console.log(`   TEAM:         ${teamsResult.count}개`);
    console.log(`   SERVICE:      ${servicesResult.count}개`);
    console.log(`   PROJECT:      ${projectsResult.count}개`);
    console.log('='.repeat(50));
    console.log('✅ 모든 PSTA 데이터 초기화 완료!\n');

  } catch (error) {
    console.error('\n❌ 초기화 실패:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearAllPstaData();
