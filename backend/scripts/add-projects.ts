import { PrismaClient, ItemType, ItemStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  // Find yg.kim user
  const user = await prisma.user.findFirst({
    where: { username: 'yg.kim' },
  });

  if (!user) {
    console.error('User yg.kim not found');
    process.exit(1);
  }

  console.log('Found user:', user.username, user.id);

  // Find 더존테크윌 client
  const client = await prisma.client.findFirst({
    where: { name: '더존테크윌' },
  });

  if (!client) {
    console.error('Client 더존테크윌 not found');
    process.exit(1);
  }

  console.log('Found client:', client.name, client.id);

  // Projects to create
  const projects = [
    '이택스코리아(유지관리)',
    '이택스코리아(차세대)',
    '양도코리아(유지관리)',
    '양도코리아(차세대)',
    '통합백오피스(차세대)',
    '사내 전산 인프라 구축(차세대)',
    '프로젝트 관리(차세대)',
  ];

  console.log('\nCreating projects...\n');

  for (const projectName of projects) {
    // Check if project already exists
    const existing = await prisma.item.findFirst({
      where: {
        name: projectName,
        type: ItemType.PROJECT,
        parentId: null,
      },
    });

    if (existing) {
      console.log(`⏭️  Project "${projectName}" already exists, skipping...`);
      continue;
    }

    const project = await prisma.item.create({
      data: {
        id: randomUUID(),
        name: projectName,
        type: ItemType.PROJECT,
        status: ItemStatus.IN_PROGRESS,
        progress: 0,
        parentId: null,
        clientId: client.id,
        assigneeId: user.id,
        createdById: user.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        updatedAt: new Date(),
        order: 0,
      },
    });

    console.log(`✅ Created project: ${project.name} (ID: ${project.id})`);
  }

  console.log('\n✨ Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
