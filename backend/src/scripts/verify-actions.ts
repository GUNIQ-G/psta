/**
 * 액션 상태 검증 스크립트
 */

import prisma from '../config/database';
import { ItemType } from '@prisma/client';

async function verifyActions() {
  console.log('=== 액션 상태 검증 ===\n');

  // 1. "양코 MyDATA" 액션 전체 조회 (isDeleted 관계없이)
  const allActions = await prisma.item.findMany({
    where: {
      name: {
        contains: '양코 MyDATA 안정화 버전 인프라 오픈 계획 매뉴얼 수립',
      },
      type: ItemType.ACTION,
    },
    select: {
      id: true,
      name: true,
      serviceTeamId: true,
      isDeleted: true,
      deletedAt: true,
    },
  });

  console.log(`"양코 MyDATA" 액션 전체: ${allActions.length}개\n`);

  allActions.forEach((action, index) => {
    console.log(`액션 #${index + 1}:`);
    console.log(`  ID: ${action.id}`);
    console.log(`  ServiceTeamId: ${action.serviceTeamId || 'null'}`);
    console.log(`  isDeleted: ${action.isDeleted}`);
    console.log(`  deletedAt: ${action.deletedAt?.toISOString() || 'null'}`);
    console.log('');
  });

  // 2. 모든 고아 액션 조회 (isDeleted 관계없이)
  const allOrphanActions = await prisma.item.findMany({
    where: {
      type: ItemType.ACTION,
      serviceTeamId: null,
    },
    select: {
      id: true,
      name: true,
      isDeleted: true,
      deletedAt: true,
    },
  });

  console.log(`\n전체 고아 액션 (isDeleted 관계없이): ${allOrphanActions.length}개`);

  const activeOrphans = allOrphanActions.filter(a => !a.isDeleted);
  const deletedOrphans = allOrphanActions.filter(a => a.isDeleted);

  console.log(`  - 활성 (isDeleted=false): ${activeOrphans.length}개`);
  console.log(`  - 삭제됨 (isDeleted=true): ${deletedOrphans.length}개`);

  if (activeOrphans.length > 0) {
    console.log('\n활성 고아 액션 (상위 10개):');
    activeOrphans.slice(0, 10).forEach((action, index) => {
      console.log(`  ${index + 1}. ${action.name} (ID: ${action.id})`);
    });
  }
}

verifyActions()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
