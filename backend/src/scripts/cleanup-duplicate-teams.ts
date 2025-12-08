/**
 * 중복 TEAM Item 정리 마이그레이션
 *
 * v1.1.9에서 ServiceTeam 구조로 전환했지만,
 * 기존 중복 TEAM Item들이 남아있어 일정관리 화면에서 중복으로 표시되는 문제 해결
 *
 * 작업 내용:
 * 1. ServiceTeam에 연결되지 않은 중복 TEAM Item soft delete
 * 2. ServiceTeamId가 null인 오래된 액션 처리
 */

import prisma from '../config/database';
import { ItemType } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');

interface CleanupStats {
  duplicateTeamItemsFound: number;
  duplicateTeamItemsDeleted: number;
  orphanActionsFound: number;
  orphanActionsDeleted: number;
  serviceTeamsUsed: number;
}

async function cleanupDuplicateTeams() {
  console.log('=== 중복 TEAM Item 정리 마이그레이션 ===\n');
  console.log(`모드: ${DRY_RUN ? 'DRY-RUN (실제 삭제 안함)' : 'PRODUCTION (실제 삭제)'}\n`);

  if (!DRY_RUN) {
    console.log('⚠️  경고: 이 스크립트는 데이터를 변경합니다!');
    console.log('⚠️  실행 전 데이터베이스 백업을 권장합니다.\n');

    // 5초 대기
    console.log('5초 후 시작합니다...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const stats: CleanupStats = {
    duplicateTeamItemsFound: 0,
    duplicateTeamItemsDeleted: 0,
    orphanActionsFound: 0,
    orphanActionsDeleted: 0,
    serviceTeamsUsed: 0,
  };

  // 1. ServiceTeam 목록 조회
  console.log('\n📋 Step 1: ServiceTeam 분석\n');
  const serviceTeams = await prisma.serviceTeam.findMany({
    include: {
      Service: {
        select: {
          id: true,
          name: true,
          Item: {
            select: {
              name: true,
            },
          },
        },
      },
      Team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  stats.serviceTeamsUsed = serviceTeams.length;
  console.log(`✓ 활성 ServiceTeam: ${serviceTeams.length}개\n`);

  // ServiceTeam별로 필요한 TEAM Item 매핑 생성
  // Key: serviceId, Value: Set of team names
  const validTeamsByService = new Map<string, Set<string>>();

  serviceTeams.forEach(st => {
    if (!validTeamsByService.has(st.serviceId)) {
      validTeamsByService.set(st.serviceId, new Set());
    }
    validTeamsByService.get(st.serviceId)!.add(st.Team.name);
  });

  console.log('📊 서비스별 팀 구성:');
  for (const [serviceId, teamNames] of validTeamsByService.entries()) {
    const service = serviceTeams.find(st => st.serviceId === serviceId)?.Service;
    console.log(`  ${service?.name}: ${Array.from(teamNames).join(', ')}`);
  }

  // 2. 모든 TEAM 타입 Item 조회
  console.log('\n\n📋 Step 2: TEAM Item 분석\n');
  const allTeamItems = await prisma.item.findMany({
    where: {
      type: ItemType.TEAM,
      isDeleted: false,
    },
    include: {
      Item: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      other_Item: {
        where: {
          isDeleted: false,
        },
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  console.log(`✓ 전체 TEAM Item: ${allTeamItems.length}개\n`);

  // 3. 중복 TEAM Item 식별 및 삭제
  console.log('\n📋 Step 3: 중복 TEAM Item 식별 및 처리\n');

  const teamItemsToDelete: string[] = [];
  const teamItemsByService = new Map<string, typeof allTeamItems>();

  // 서비스별로 TEAM Item 그룹화
  allTeamItems.forEach(teamItem => {
    if (teamItem.parentId) {
      if (!teamItemsByService.has(teamItem.parentId)) {
        teamItemsByService.set(teamItem.parentId, []);
      }
      teamItemsByService.get(teamItem.parentId)!.push(teamItem);
    }
  });

  // 각 서비스에서 중복 TEAM Item 찾기
  for (const [serviceId, teamItems] of teamItemsByService.entries()) {
    const validTeamNames = validTeamsByService.get(serviceId);

    if (!validTeamNames) {
      // ServiceTeam이 없는 서비스 - 모든 TEAM Item 삭제 대상
      console.log(`⚠️  서비스 ${serviceId}에 ServiceTeam이 없음 - 모든 TEAM Item 삭제 대상`);
      teamItems.forEach(item => {
        teamItemsToDelete.push(item.id);
        stats.duplicateTeamItemsFound++;
      });
      continue;
    }

    // 팀 이름별로 그룹화
    const teamsByName = new Map<string, typeof allTeamItems>();
    teamItems.forEach(item => {
      if (!teamsByName.has(item.name)) {
        teamsByName.set(item.name, []);
      }
      teamsByName.get(item.name)!.push(item);
    });

    // 각 팀 이름별로 처리
    for (const [teamName, items] of teamsByName.entries()) {
      if (!validTeamNames.has(teamName)) {
        // ServiceTeam에 없는 팀 - 모두 삭제
        console.log(`  ✗ "${teamName}" (서비스 ${serviceId}): ServiceTeam에 없음 → 삭제 (${items.length}개)`);
        items.forEach(item => {
          teamItemsToDelete.push(item.id);
          stats.duplicateTeamItemsFound++;
        });
      } else if (items.length > 1) {
        // 중복 - 하나만 남기고 나머지 삭제
        console.log(`  ⚠️  "${teamName}" (서비스 ${serviceId}): ${items.length}개 중복 발견`);

        // 자식 액션이 있는 것 우선, 없으면 첫 번째 것을 유지
        items.sort((a, b) => {
          const aHasChildren = a.other_Item.length > 0;
          const bHasChildren = b.other_Item.length > 0;
          if (aHasChildren && !bHasChildren) return -1;
          if (!aHasChildren && bHasChildren) return 1;
          return 0;
        });

        const keepItem = items[0];
        const deleteItems = items.slice(1);

        console.log(`    ✓ 유지: ${keepItem.id} (자식 ${keepItem.other_Item.length}개)`);
        deleteItems.forEach(item => {
          console.log(`    ✗ 삭제: ${item.id} (자식 ${item.other_Item.length}개)`);
          teamItemsToDelete.push(item.id);
          stats.duplicateTeamItemsFound++;
        });
      } else {
        console.log(`  ✓ "${teamName}" (서비스 ${serviceId}): 정상 (1개)`);
      }
    }
  }

  // 4. 고아 액션 처리 (ServiceTeamId가 null인 액션)
  console.log('\n\n📋 Step 4: 고아 액션 처리\n');

  const orphanActions = await prisma.item.findMany({
    where: {
      type: ItemType.ACTION,
      serviceTeamId: null,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      parentId: true,
    },
  });

  stats.orphanActionsFound = orphanActions.length;
  console.log(`✓ ServiceTeamId가 null인 액션: ${orphanActions.length}개\n`);

  if (orphanActions.length > 0) {
    console.log('고아 액션 목록 (처음 10개):');
    orphanActions.slice(0, 10).forEach(action => {
      console.log(`  - ${action.name} (ID: ${action.id}, parentId: ${action.parentId})`);
    });
    if (orphanActions.length > 10) {
      console.log(`  ... 외 ${orphanActions.length - 10}개`);
    }
  }

  // 5. 실제 삭제 실행
  console.log('\n\n📋 Step 5: 삭제 실행\n');

  if (DRY_RUN) {
    console.log('🔍 DRY-RUN 모드: 실제 삭제하지 않습니다.\n');
    console.log(`삭제 예정 TEAM Item: ${teamItemsToDelete.length}개`);
    console.log(`삭제 예정 고아 액션: ${orphanActions.length}개`);
  } else {
    console.log('💾 실제 삭제 시작...\n');

    // TEAM Item soft delete
    if (teamItemsToDelete.length > 0) {
      const result = await prisma.item.updateMany({
        where: {
          id: { in: teamItemsToDelete },
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
      stats.duplicateTeamItemsDeleted = result.count;
      console.log(`✓ TEAM Item ${result.count}개 soft delete 완료`);
    }

    // 고아 액션 soft delete
    if (orphanActions.length > 0) {
      const result = await prisma.item.updateMany({
        where: {
          id: { in: orphanActions.map(a => a.id) },
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
      stats.orphanActionsDeleted = result.count;
      console.log(`✓ 고아 액션 ${result.count}개 soft delete 완료`);
    }
  }

  // 6. 최종 결과 출력
  console.log('\n\n=== 📊 최종 결과 ===\n');
  console.log(`활성 ServiceTeam: ${stats.serviceTeamsUsed}개`);
  console.log(`\n중복 TEAM Item:`);
  console.log(`  - 발견: ${stats.duplicateTeamItemsFound}개`);
  console.log(`  - 삭제: ${stats.duplicateTeamItemsDeleted}개`);
  console.log(`\n고아 액션 (serviceTeamId = null):`);
  console.log(`  - 발견: ${stats.orphanActionsFound}개`);
  console.log(`  - 삭제: ${stats.orphanActionsDeleted}개`);

  if (DRY_RUN) {
    console.log('\n\n💡 실제 삭제를 진행하려면 --dry-run 없이 실행하세요:');
    console.log('   npx ts-node src/scripts/cleanup-duplicate-teams.ts');
  } else {
    console.log('\n\n✅ 마이그레이션 완료!');
  }

  console.log('\n=========================\n');
}

cleanupDuplicateTeams()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
