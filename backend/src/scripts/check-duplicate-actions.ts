/**
 * 중복 액션 확인 스크립트
 *
 * "양코 MyDATA 안정화 버전 인프라 오픈 계획 매뉴얼 수립" 액션이
 * 여러 프로젝트에 중복으로 나타나는 원인을 파악합니다.
 */

import prisma from '../config/database';
import { ItemType } from '@prisma/client';

async function checkDuplicateActions() {
  console.log('=== 중복 액션 분석 시작 ===\n');

  // 1. 해당 액션 찾기
  const actionName = '양코 MyDATA 안정화 버전 인프라 오픈 계획 매뉴얼 수립';
  const actions = await prisma.item.findMany({
    where: {
      name: {
        contains: actionName,
      },
      type: ItemType.ACTION,
    },
    include: {
      ServiceTeam: {
        include: {
          Service: {
            select: {
              id: true,
              name: true,
              parentId: true,
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
      },
    },
  });

  console.log(`\n1️⃣ 찾은 액션 개수: ${actions.length}\n`);

  actions.forEach((action, index) => {
    console.log(`\n액션 #${index + 1}:`);
    console.log(`  ID: ${action.id}`);
    console.log(`  Name: ${action.name}`);
    console.log(`  ServiceTeamId: ${action.serviceTeamId}`);

    if (action.ServiceTeam) {
      console.log(`  ServiceTeam:`);
      console.log(`    - ServiceTeam ID: ${action.ServiceTeam.id}`);
      console.log(`    - Service: ${action.ServiceTeam.Service?.name} (ID: ${action.ServiceTeam.Service?.id})`);
      console.log(`    - Project: ${action.ServiceTeam.Service?.Item?.name}`);
      console.log(`    - Team: ${action.ServiceTeam.Team?.name} (ID: ${action.ServiceTeam.Team?.id})`);
    }
  });

  // 2. TEAM 타입 Item 중복 확인
  console.log('\n\n2️⃣ TEAM 타입 Item 분석:\n');

  const teamItems = await prisma.item.findMany({
    where: {
      type: ItemType.TEAM,
      isDeleted: false,
    },
    include: {
      Item: {
        select: {
          name: true,
          type: true,
        },
      },
    },
  });

  console.log(`총 TEAM 타입 Item 개수: ${teamItems.length}\n`);

  // 팀 이름별로 그룹화
  const teamsByName = new Map<string, any[]>();
  teamItems.forEach((team) => {
    const name = team.name;
    if (!teamsByName.has(name)) {
      teamsByName.set(name, []);
    }
    teamsByName.get(name)!.push(team);
  });

  console.log('중복된 팀 이름:');
  for (const [name, teams] of teamsByName.entries()) {
    if (teams.length > 1) {
      console.log(`\n  팀명: "${name}" (${teams.length}개 중복)`);
      teams.forEach((team, idx) => {
        console.log(`    #${idx + 1}: ID=${team.id}, ParentId=${team.parentId}, Parent=${team.Item?.name}`);
      });
    }
  }

  // 3. ServiceTeam 확인
  console.log('\n\n3️⃣ ServiceTeam 분석:\n');

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

  console.log(`총 ServiceTeam 개수: ${serviceTeams.length}\n`);

  // 4. getItemTree 로직 시뮬레이션
  console.log('\n4️⃣ getItemTree 로직 시뮬레이션:\n');

  // 특정 서비스의 TEAM Item들을 가져오기
  const serviceWithActions = await prisma.item.findFirst({
    where: {
      type: ItemType.SERVICE,
      isDeleted: false,
      other_Item: {
        some: {
          name: {
            contains: actionName,
          },
        },
      },
    },
  });

  if (serviceWithActions) {
    console.log(`\n해당 액션이 속한 서비스: ${serviceWithActions.name} (ID: ${serviceWithActions.id})\n`);

    const teamItemsInService = await prisma.item.findMany({
      where: {
        parentId: serviceWithActions.id,
        type: ItemType.TEAM,
        isDeleted: false,
      },
    });

    console.log(`이 서비스 하위의 TEAM Item 개수: ${teamItemsInService.length}\n`);

    for (const teamItem of teamItemsInService) {
      console.log(`\nTEAM Item: ${teamItem.name} (ID: ${teamItem.id})`);

      // getItemTree에서 실행하는 쿼리 시뮬레이션
      const serviceTeam = await prisma.serviceTeam.findFirst({
        where: {
          serviceId: teamItem.parentId || undefined,
          Team: {
            name: teamItem.name,
          },
        },
        include: {
          Team: true,
          Service: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      console.log(`  findFirst 결과:`);
      if (serviceTeam) {
        console.log(`    ServiceTeam ID: ${serviceTeam.id}`);
        console.log(`    Service: ${serviceTeam.Service.name}`);
        console.log(`    Team: ${serviceTeam.Team.name}`);

        const actionsViaServiceTeam = await prisma.item.findMany({
          where: {
            type: ItemType.ACTION,
            serviceTeamId: serviceTeam.id,
            isDeleted: false,
          },
        });

        console.log(`    이 ServiceTeam의 액션 개수: ${actionsViaServiceTeam.length}`);
        actionsViaServiceTeam.forEach((action) => {
          console.log(`      - ${action.name}`);
        });
      } else {
        console.log(`    ServiceTeam을 찾지 못함!`);
      }
    }
  }

  console.log('\n\n=== 분석 완료 ===');
}

checkDuplicateActions()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
