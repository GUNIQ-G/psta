import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function restoreServiceTeams() {
  console.log('=== ServiceTeam 복구 시작 ===\n');

  // 1. Get all Team entities (새로 생성된 팀)
  const teamEntities = await prisma.team.findMany();
  console.log('현재 Team 엔티티:', teamEntities.map(t => t.name).join(', '));

  // Create a map of team name -> team entity
  const teamNameMap = new Map(teamEntities.map(t => [t.name, t]));

  // 2. Get all TEAM Items (Item 테이블의 TEAM 타입)
  const teamItems = await prisma.item.findMany({
    where: { type: 'TEAM' },
    select: {
      id: true,
      name: true,
      parentId: true,  // This is the SERVICE Item ID
      serviceTeamId: true
    }
  });
  console.log('\nTEAM Item 수:', teamItems.length);

  // 3. For each TEAM Item, create a ServiceTeam if it matches a Team entity
  let created = 0;
  let skipped = 0;
  const notFound: string[] = [];

  for (const teamItem of teamItems) {
    // Find matching Team entity by name
    const teamEntity = teamNameMap.get(teamItem.name);

    if (!teamEntity) {
      if (!notFound.includes(teamItem.name)) {
        notFound.push(teamItem.name);
      }
      skipped++;
      continue;
    }

    // The parentId of TEAM Item is the SERVICE Item ID
    const serviceId = teamItem.parentId;
    if (!serviceId) {
      console.log('  경고: TEAM Item에 parentId 없음:', teamItem.id, teamItem.name);
      skipped++;
      continue;
    }

    // Check if ServiceTeam already exists
    const existing = await prisma.serviceTeam.findFirst({
      where: {
        serviceId: serviceId,
        teamId: teamEntity.id
      }
    });

    if (existing) {
      // Update TEAM Item with existing serviceTeamId
      await prisma.item.update({
        where: { id: teamItem.id },
        data: { serviceTeamId: existing.id }
      });
      skipped++;
      continue;
    }

    // Create new ServiceTeam
    const newServiceTeam = await prisma.serviceTeam.create({
      data: {
        id: randomUUID(),
        serviceId: serviceId,
        teamId: teamEntity.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Update TEAM Item with new serviceTeamId
    await prisma.item.update({
      where: { id: teamItem.id },
      data: { serviceTeamId: newServiceTeam.id }
    });

    created++;
  }

  console.log('\n=== 결과 ===');
  console.log('ServiceTeam 생성:', created);
  console.log('건너뜀:', skipped);
  console.log('매칭 안 된 팀 이름:', notFound.join(', ') || '없음');

  // 4. Check final ServiceTeam count
  const finalCount = await prisma.serviceTeam.count();
  console.log('\n최종 ServiceTeam 수:', finalCount);

  // 5. Now update ACTION items to reference their parent TEAM Item's serviceTeamId
  console.log('\n=== ACTION 업데이트 시작 ===');

  const actions = await prisma.item.findMany({
    where: { type: 'ACTION' }
  });

  let actionUpdated = 0;
  for (const action of actions) {
    // Find parent TEAM Item by looking at the parent chain
    // ACTION -> TEAM Item (parentId)
    if (!action.parentId) continue;

    const parentTeamItem = await prisma.item.findUnique({
      where: { id: action.parentId },
      select: { type: true, serviceTeamId: true }
    });

    if (parentTeamItem?.type === 'TEAM' && parentTeamItem.serviceTeamId) {
      await prisma.item.update({
        where: { id: action.id },
        data: { serviceTeamId: parentTeamItem.serviceTeamId }
      });
      actionUpdated++;
    }
  }

  console.log('ACTION 업데이트:', actionUpdated);
}

restoreServiceTeams()
  .then(() => {
    console.log('\n=== 복구 완료 ===');
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error('오류:', e);
    return prisma.$disconnect();
  });
