/**
 * ServiceTeam 조회 로직 문제 확인
 */

import prisma from '../config/database';
import { ItemType } from '@prisma/client';

async function checkServiceTeamIssue() {
  console.log('=== ServiceTeam 조회 로직 문제 확인 ===\n');

  // 1. PSTA 서비스 찾기
  const pstaService = await prisma.item.findFirst({
    where: {
      name: 'PSTA) 프로젝트 관리 시스템 (PMS)',
      type: ItemType.SERVICE,
    },
  });

  if (!pstaService) {
    console.log('PSTA 서비스를 찾을 수 없습니다.');
    return;
  }

  console.log(`PSTA 서비스: ${pstaService.name} (ID: ${pstaService.id})\n`);

  // 2. PSTA 서비스 하위의 개발팀 TEAM Item 찾기
  const teamItem = await prisma.item.findFirst({
    where: {
      parentId: pstaService.id,
      name: '개발팀',
      type: ItemType.TEAM,
      isDeleted: false,
    },
  });

  if (!teamItem) {
    console.log('개발팀 TEAM Item을 찾을 수 없습니다.');
    return;
  }

  console.log(`개발팀 TEAM Item: ID=${teamItem.id}\n`);

  // 3. getItemTree 로직 시뮬레이션: ServiceTeam.findFirst
  console.log('📋 getItemTree 로직 시뮬레이션:\n');
  console.log(`조건:`);
  console.log(`  serviceId: ${teamItem.parentId}`);
  console.log(`  Team.name: "${teamItem.name}"\n`);

  const serviceTeam = await prisma.serviceTeam.findFirst({
    where: {
      serviceId: teamItem.parentId || undefined,
      Team: {
        name: teamItem.name,
      },
    },
    include: {
      Service: {
        select: {
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
          name: true,
        },
      },
    },
  });

  if (!serviceTeam) {
    console.log('❌ ServiceTeam을 찾지 못함!');
    return;
  }

  console.log(`✓ 찾은 ServiceTeam:`);
  console.log(`  ID: ${serviceTeam.id}`);
  console.log(`  Service: ${serviceTeam.Service.name}`);
  console.log(`  Project: ${serviceTeam.Service.Item?.name}`);
  console.log(`  Team: ${serviceTeam.Team.name}\n`);

  // 4. 이 ServiceTeam에 속한 액션 조회
  const actions = await prisma.item.findMany({
    where: {
      type: ItemType.ACTION,
      serviceTeamId: serviceTeam.id,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
    },
  });

  console.log(`이 ServiceTeam의 액션: ${actions.length}개\n`);
  actions.forEach(action => {
    console.log(`  - ${action.name} (ID: ${action.id})`);
  });

  // 5. 모든 "개발팀" ServiceTeam 조회
  console.log(`\n\n📋 모든 "개발팀" ServiceTeam:\n`);

  const allDevTeamST = await prisma.serviceTeam.findMany({
    where: {
      Team: {
        name: '개발팀',
      },
    },
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

  console.log(`총 ${allDevTeamST.length}개\n`);
  allDevTeamST.forEach((st, index) => {
    console.log(`#${index + 1}:`);
    console.log(`  ServiceTeam ID: ${st.id}`);
    console.log(`  Service ID: ${st.serviceId}`);
    console.log(`  Service: ${st.Service.name}`);
    console.log(`  Project: ${st.Service.Item?.name}`);
    console.log(`  Team: ${st.Team.name} (Team ID: ${st.Team.id})`);
    console.log('');
  });

  // 6. 만약 PSTA 서비스 ID로 필터링하면?
  console.log(`\n📋 PSTA 서비스 (ID: ${pstaService.id})의 ServiceTeam:\n`);

  const pstaServiceTeams = await prisma.serviceTeam.findMany({
    where: {
      serviceId: pstaService.id,
    },
    include: {
      Team: true,
    },
  });

  console.log(`총 ${pstaServiceTeams.length}개\n`);
  pstaServiceTeams.forEach((st, index) => {
    console.log(`#${index + 1}:`);
    console.log(`  ServiceTeam ID: ${st.id}`);
    console.log(`  Team: ${st.Team.name} (Team ID: ${st.Team.id})`);
    console.log('');
  });
}

checkServiceTeamIssue()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
