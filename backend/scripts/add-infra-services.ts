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

  // Find 사내 전산 인프라 구축(차세대) project
  const project = await prisma.item.findFirst({
    where: {
      name: '사내 전산 인프라 구축(차세대)',
      type: ItemType.PROJECT,
      parentId: null,
    },
  });

  if (!project) {
    console.error('Project 사내 전산 인프라 구축(차세대) not found');
    process.exit(1);
  }

  console.log('Found project:', project.name, project.id);

  // Services to create
  const services = [
    '인프라 현황 분석',
    '차세대 인프라 구축',
    '인프라 관리 솔루션 테스트',
    '인프라 구성 표준 및 정책 문서화',
    '인프라 보안 정책 및 표준 문서화',
  ];

  console.log('\nCreating services...\n');

  for (const serviceName of services) {
    // Check if service already exists
    const existing = await prisma.item.findFirst({
      where: {
        name: serviceName,
        type: ItemType.SERVICE,
        parentId: project.id,
      },
    });

    if (existing) {
      console.log(`⏭️  Service "${serviceName}" already exists, skipping...`);
      continue;
    }

    const service = await prisma.item.create({
      data: {
        id: randomUUID(),
        name: serviceName,
        type: ItemType.SERVICE,
        status: ItemStatus.IN_PROGRESS,
        progress: 0,
        parentId: project.id,
        clientId: project.clientId,
        assigneeId: user.id,
        createdById: user.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        updatedAt: new Date(),
        order: 0,
      },
    });

    console.log(`✅ Created service: ${service.name} (ID: ${service.id})`);
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
