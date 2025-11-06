import { PrismaClient, ItemType, ItemStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding teams to all services...');

  // Get admin user
  const adminUser = await prisma.user.findFirst({
    where: { username: 'admin' }
  });

  if (!adminUser) {
    console.error('Admin user not found. Please login first.');
    return;
  }

  // Get client
  const dzTechWillClient = await prisma.client.findUnique({
    where: { code: 'DZ_TECHWILL' }
  });

  if (!dzTechWillClient) {
    console.error('Client not found');
    return;
  }

  // Get all services
  const services = await prisma.item.findMany({
    where: {
      type: ItemType.SERVICE,
      clientId: dzTechWillClient.id,
    },
    orderBy: { order: 'asc' }
  });

  console.log(`Found ${services.length} services`);

  const teams = ['기획팀', '디자인팀', '개발팀', '인프라팀'];

  for (const service of services) {
    console.log(`Adding teams to ${service.name}`);

    let order = 1;
    for (const teamName of teams) {
      await prisma.item.create({
        data: {
          type: ItemType.TEAM,
          name: teamName,
          status: ItemStatus.IN_PROGRESS,
          progress: 0,
          startDate: service.startDate,
          endDate: service.endDate,
          clientId: dzTechWillClient.id,
          parentId: service.id,
          createdById: adminUser.id,
          assigneeId: adminUser.id,
          order: order++,
        }
      });
    }

    console.log(`  ✓ Added ${teams.length} teams to ${service.name}`);
  }

  console.log('All teams added successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
