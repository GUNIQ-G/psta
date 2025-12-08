import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function updateTeamNames() {
  console.log('=== TEAM Item 이름 변경 시작 ===\n');

  // 1. Check current Team entities
  const teamEntities = await prisma.team.findMany();
  console.log('현재 Team 엔티티:', teamEntities.map(t => t.name).join(', '));

  // Create map
  const teamNameMap = new Map(teamEntities.map(t => [t.name, t]));

  // 2. Update '솔루션개발본부장' -> '서비스개발본부'
  const updated1 = await prisma.item.updateMany({
    where: { type: 'TEAM', name: '솔루션개발본부장' },
    data: { name: '서비스개발본부' }
  });
  console.log('\n솔루션개발본부장 -> 서비스개발본부:', updated1.count, '개 변경');

  // 3. Update '디자인팀' -> '기획디자인팀'
  const updated2 = await prisma.item.updateMany({
    where: { type: 'TEAM', name: '디자인팀' },
    data: { name: '기획디자인팀' }
  });
  console.log('디자인팀 -> 기획디자인팀:', updated2.count, '개 변경');

  // 4. Now link them to ServiceTeams
  console.log('\n=== ServiceTeam 연결 ===');

  // Get the renamed TEAM Items that still have null serviceTeamId
  const teamItems = await prisma.item.findMany({
    where: {
      type: 'TEAM',
      name: { in: ['서비스개발본부', '기획디자인팀'] },
      serviceTeamId: null
    }
  });

  let created = 0;
  for (const teamItem of teamItems) {
    const teamEntity = teamNameMap.get(teamItem.name);
    if (!teamEntity || !teamItem.parentId) continue;

    // Check if ServiceTeam exists
    let serviceTeam = await prisma.serviceTeam.findFirst({
      where: {
        serviceId: teamItem.parentId,
        teamId: teamEntity.id
      }
    });

    if (!serviceTeam) {
      serviceTeam = await prisma.serviceTeam.create({
        data: {
          id: randomUUID(),
          serviceId: teamItem.parentId,
          teamId: teamEntity.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      created++;
    }

    // Update TEAM Item
    await prisma.item.update({
      where: { id: teamItem.id },
      data: { serviceTeamId: serviceTeam.id }
    });
  }

  console.log('ServiceTeam 생성:', created);

  // 5. Update ACTION items for newly linked TEAM Items
  console.log('\n=== ACTION 업데이트 ===');

  const actions = await prisma.item.findMany({
    where: {
      type: 'ACTION',
      serviceTeamId: null
    }
  });

  let actionUpdated = 0;
  for (const action of actions) {
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

  // 6. Final check
  const remainingNull = await prisma.item.count({
    where: { type: 'ACTION', serviceTeamId: null }
  });
  console.log('\n남은 serviceTeamId null ACTION:', remainingNull);
}

updateTeamNames().then(() => {
  console.log('\n=== 완료 ===');
  return prisma.$disconnect();
});
