import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting database...');

  // Delete all items (will cascade delete due to relations)
  await prisma.item.deleteMany({});
  console.log('All items deleted');

  // Delete all clients
  await prisma.client.deleteMany({});
  console.log('All clients deleted');

  // Delete all slack notifications
  await prisma.slackNotification.deleteMany({});
  console.log('All slack notifications deleted');

  console.log('Database reset completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
