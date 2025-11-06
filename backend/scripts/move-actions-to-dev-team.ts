import { PrismaClient, ItemType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Moving actions to 개발팀...');

  // Get client
  const dzTechWillClient = await prisma.client.findUnique({
    where: { code: 'DZ_TECHWILL' }
  });

  if (!dzTechWillClient) {
    console.error('Client not found');
    return;
  }

  // Find 결제 모듈 service
  const paymentService = await prisma.item.findFirst({
    where: {
      type: ItemType.SERVICE,
      name: '결제 모듈',
      clientId: dzTechWillClient.id,
    }
  });

  if (!paymentService) {
    console.error('결제 모듈 service not found');
    return;
  }

  // Find 개발팀 team under 결제 모듈
  const devTeam = await prisma.item.findFirst({
    where: {
      type: ItemType.TEAM,
      name: '개발팀',
      parentId: paymentService.id,
      clientId: dzTechWillClient.id,
    }
  });

  if (!devTeam) {
    console.error('개발팀 not found under 결제 모듈');
    return;
  }

  console.log(`Found team: ${devTeam.name} under ${paymentService.name}`);

  // Find all actions that are directly under 결제 모듈
  const actions = await prisma.item.findMany({
    where: {
      type: ItemType.ACTION,
      parentId: paymentService.id,
      clientId: dzTechWillClient.id,
    }
  });

  console.log(`Found ${actions.length} actions to move`);

  // Move actions to 개발팀
  for (const action of actions) {
    await prisma.item.update({
      where: { id: action.id },
      data: { parentId: devTeam.id }
    });
    console.log(`  ✓ Moved ${action.name} to 개발팀`);
  }

  console.log('All actions moved successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
