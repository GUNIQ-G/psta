import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      id: randomUUID(),
      username: 'admin',
      email: 'admin@psta.local',
      displayName: 'System Administrator',
      ldapDn: null,
      isActive: true,
      updatedAt: new Date(),
    },
  });

  console.log('✅ Admin user created:', admin.username);

  // Create sample client
  const client = await prisma.client.upsert({
    where: { code: 'SAMPLE' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'Sample Client',
      code: 'SAMPLE',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  console.log('✅ Sample client created:', client.name);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
