import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating projects with dates and client...');

  // Create or get 더존테크윌 client
  const dzTechWillClient = await prisma.client.upsert({
    where: { code: 'DZ_TECHWILL' },
    update: {
      name: '더존테크윌',
    },
    create: {
      name: '더존테크윌',
      code: 'DZ_TECHWILL',
    }
  });

  console.log('Client 더존테크윌 created/updated');

  // Set dates
  const startDate = new Date('2025-01-01');
  const endDate = new Date('2025-12-31');

  // Update all items (projects) to have the same client and dates
  const result = await prisma.item.updateMany({
    data: {
      clientId: dzTechWillClient.id,
      startDate: startDate,
      endDate: endDate,
    }
  });

  console.log(`Updated ${result.count} projects`);

  // Delete old clients that are no longer used
  await prisma.client.deleteMany({
    where: {
      code: {
        in: ['ETAXKOREA', 'YANGDO', 'BACKOFFICE', 'INFRA', 'PMS']
      }
    }
  });

  console.log('Old clients deleted');
  console.log('Update completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
