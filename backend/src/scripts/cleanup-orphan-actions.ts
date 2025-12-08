/**
 * 고아 액션 정리 마이그레이션
 *
 * ServiceTeamId가 null인 오래된 액션들을 정리합니다.
 * v1.1.9에서 ServiceTeam 구조로 전환했지만,
 * 기존 데이터 중 ServiceTeam에 연결되지 않은 액션들이 남아있어 중복으로 표시됩니다.
 */

import prisma from '../config/database';
import { ItemType } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');

async function cleanupOrphanActions() {
  console.log('=== 고아 액션 정리 마이그레이션 ===\n');
  console.log(`모드: ${DRY_RUN ? 'DRY-RUN (실제 삭제 안함)' : 'PRODUCTION (실제 삭제)'}\n`);

  if (!DRY_RUN) {
    console.log('⚠️  경고: 이 스크립트는 데이터를 변경합니다!');
    console.log('⚠️  실행 전 데이터베이스 백업을 권장합니다.\n');

    // 5초 대기
    console.log('5초 후 시작합니다...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 1. 고아 액션 조회
  console.log('📋 Step 1: 고아 액션 조회\n');

  const orphanActions = await prisma.item.findMany({
    where: {
      type: ItemType.ACTION,
      serviceTeamId: null,
      isDeleted: false,
    },
    include: {
      User_Item_assigneeIdToUser: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`✓ ServiceTeamId가 null인 액션: ${orphanActions.length}개\n`);

  if (orphanActions.length === 0) {
    console.log('✅ 정리할 고아 액션이 없습니다.');
    return;
  }

  // 2. 액션 목록 출력
  console.log('📋 Step 2: 고아 액션 목록 (상위 20개)\n');

  const displayActions = orphanActions.slice(0, 20);
  displayActions.forEach((action, index) => {
    console.log(`${index + 1}. ${action.name}`);
    console.log(`   ID: ${action.id}`);
    console.log(`   담당자: ${action.User_Item_assigneeIdToUser?.displayName || '미할당'}`);
    console.log(`   생성일: ${action.createdAt.toISOString().split('T')[0]}`);
    console.log(`   parentId: ${action.parentId || 'null'}`);
    console.log('');
  });

  if (orphanActions.length > 20) {
    console.log(`... 외 ${orphanActions.length - 20}개\n`);
  }

  // 3. 이름별 그룹화 통계
  console.log('📋 Step 3: 이름별 중복 통계\n');

  const actionsByName = new Map<string, typeof orphanActions>();
  orphanActions.forEach(action => {
    if (!actionsByName.has(action.name)) {
      actionsByName.set(action.name, []);
    }
    actionsByName.get(action.name)!.push(action);
  });

  const duplicateNames = Array.from(actionsByName.entries())
    .filter(([_, actions]) => actions.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`중복된 액션명: ${duplicateNames.length}개\n`);

  duplicateNames.slice(0, 10).forEach(([name, actions]) => {
    console.log(`  "${name}": ${actions.length}개`);
  });

  if (duplicateNames.length > 10) {
    console.log(`  ... 외 ${duplicateNames.length - 10}개\n`);
  }

  // 4. 삭제 실행
  console.log('\n📋 Step 4: 삭제 실행\n');

  if (DRY_RUN) {
    console.log('🔍 DRY-RUN 모드: 실제 삭제하지 않습니다.\n');
    console.log(`삭제 예정 고아 액션: ${orphanActions.length}개`);
  } else {
    console.log('💾 실제 삭제 시작...\n');

    const result = await prisma.item.updateMany({
      where: {
        id: { in: orphanActions.map(a => a.id) },
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    console.log(`✓ 고아 액션 ${result.count}개 soft delete 완료\n`);
  }

  // 5. 최종 결과
  console.log('\n=== 📊 최종 결과 ===\n');
  console.log(`고아 액션 (serviceTeamId = null):`);
  console.log(`  - 발견: ${orphanActions.length}개`);
  console.log(`  - 삭제: ${DRY_RUN ? 0 : orphanActions.length}개`);
  console.log(`  - 중복된 액션명: ${duplicateNames.length}개`);

  if (DRY_RUN) {
    console.log('\n\n💡 실제 삭제를 진행하려면 --dry-run 없이 실행하세요:');
    console.log('   npx ts-node src/scripts/cleanup-orphan-actions.ts');
  } else {
    console.log('\n\n✅ 마이그레이션 완료!');
    console.log('\n💡 복원이 필요한 경우 휴지통에서 복원할 수 있습니다.');
  }

  console.log('\n=========================\n');
}

cleanupOrphanActions()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
