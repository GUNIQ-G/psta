/**
 * 특정 프로젝트 하위 항목 조회
 */

import prisma from '../config/database';
import { ItemType } from '@prisma/client';

async function checkSpecificProject() {
  console.log('=== 사내 협업/그룹웨어 시스템 프로젝트 조회 ===\n');

  // 1. 프로젝트 찾기
  const projects = await prisma.item.findMany({
    where: {
      name: {
        contains: '사내 협업',
      },
      type: ItemType.PROJECT,
    },
    select: {
      id: true,
      name: true,
      isDeleted: true,
    },
  });

  console.log(`"사내 협업" 프로젝트: ${projects.length}개\n`);
  projects.forEach(p => {
    console.log(`  - ${p.name} (ID: ${p.id}, isDeleted: ${p.isDeleted})`);
  });

  if (projects.length === 0) {
    console.log('프로젝트를 찾을 수 없습니다.');
    return;
  }

  const project = projects[0];

  // 2. 서비스 조회
  console.log(`\n\n📋 프로젝트 하위 서비스:\n`);
  const services = await prisma.item.findMany({
    where: {
      parentId: project.id,
      type: ItemType.SERVICE,
    },
    select: {
      id: true,
      name: true,
      isDeleted: true,
    },
  });

  console.log(`서비스: ${services.length}개\n`);
  services.forEach(s => {
    console.log(`  - ${s.name} (ID: ${s.id}, isDeleted: ${s.isDeleted})`);
  });

  // 3. 각 서비스의 팀 조회
  for (const service of services) {
    console.log(`\n\n📋 서비스 "${service.name}" 하위 팀:\n`);

    const teams = await prisma.item.findMany({
      where: {
        parentId: service.id,
        type: ItemType.TEAM,
      },
      select: {
        id: true,
        name: true,
        isDeleted: true,
      },
    });

    console.log(`팀: ${teams.length}개\n`);
    teams.forEach(t => {
      console.log(`  - ${t.name} (ID: ${t.id}, isDeleted: ${t.isDeleted})`);
    });

    // 4. 각 팀의 액션 조회 (parentId 기반)
    for (const team of teams) {
      console.log(`\n  팀 "${team.name}" 하위 액션 (parentId 기반):\n`);

      const actions = await prisma.item.findMany({
        where: {
          parentId: team.id,
          type: ItemType.ACTION,
        },
        select: {
          id: true,
          name: true,
          serviceTeamId: true,
          isDeleted: true,
        },
      });

      console.log(`  액션: ${actions.length}개\n`);
      actions.forEach(a => {
        console.log(`    - ${a.name}`);
        console.log(`      ID: ${a.id}`);
        console.log(`      ServiceTeamId: ${a.serviceTeamId || 'null'}`);
        console.log(`      isDeleted: ${a.isDeleted}`);
        console.log('');
      });
    }

    // 5. ServiceTeam 기반 조회
    console.log(`\n  서비스 "${service.name}"의 ServiceTeam:\n`);

    const serviceTeams = await prisma.serviceTeam.findMany({
      where: {
        serviceId: service.id,
      },
      include: {
        Team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`  ServiceTeam: ${serviceTeams.length}개\n`);
    for (const st of serviceTeams) {
      console.log(`    - Team: ${st.Team.name} (ServiceTeam ID: ${st.id})`);

      // ServiceTeam에 속한 액션 조회
      const stActions = await prisma.item.findMany({
        where: {
          serviceTeamId: st.id,
          type: ItemType.ACTION,
        },
        select: {
          id: true,
          name: true,
          isDeleted: true,
        },
      });

      console.log(`      액션: ${stActions.length}개`);
      stActions.forEach(action => {
        console.log(`        * ${action.name} (ID: ${action.id}, isDeleted: ${action.isDeleted})`);
      });
      console.log('');
    }
  }

  // 6. "양코 MyDATA" 액션 전체 검색
  console.log(`\n\n📋 "양코 MyDATA" 액션 전체 검색:\n`);

  const yangkoActions = await prisma.item.findMany({
    where: {
      name: {
        contains: '양코 MyDATA',
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
      },
    },
  });

  console.log(`총 ${yangkoActions.length}개\n`);
  yangkoActions.forEach((action, index) => {
    console.log(`액션 #${index + 1}:`);
    console.log(`  ID: ${action.id}`);
    console.log(`  Name: ${action.name}`);
    console.log(`  parentId: ${action.parentId}`);
    console.log(`  serviceTeamId: ${action.serviceTeamId}`);
    console.log(`  isDeleted: ${action.isDeleted}`);
    if (action.ServiceTeam) {
      console.log(`  프로젝트: ${action.ServiceTeam.Service?.Item?.name}`);
      console.log(`  서비스: ${action.ServiceTeam.Service?.name}`);
      console.log(`  팀: ${action.ServiceTeam.Team?.name}`);
    }
    console.log('');
  });
}

checkSpecificProject()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
