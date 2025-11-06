import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing sample data...');

  // Get the DZ_TECHWILL client
  const client = await prisma.client.findFirst({
    where: { code: 'DZ_TECHWILL' },
  });

  if (!client) {
    console.log('❌ Client DZ_TECHWILL not found');
    return;
  }

  console.log(`📌 Found client: ${client.name} (${client.code})`);

  // Delete all items for this client (cascade will handle hierarchy)
  const deletedItems = await prisma.item.deleteMany({
    where: { clientId: client.id },
  });

  console.log(`✅ Deleted ${deletedItems.count} items`);
  console.log('✨ Sample data cleared successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
