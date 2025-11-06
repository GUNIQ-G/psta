import { PrismaClient, ItemType, ItemStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating clients and projects...');

  // Get admin user
  const adminUser = await prisma.user.findFirst({
    where: { username: 'admin' }
  });

  if (!adminUser) {
    console.error('Admin user not found. Please login first.');
    return;
  }

  // Create clients
  const etaxkoreaClient = await prisma.client.upsert({
    where: { code: 'ETAXKOREA' },
    update: {},
    create: {
      name: '이택스코리아',
      code: 'ETAXKOREA',
    }
  });

  const yangdoClient = await prisma.client.upsert({
    where: { code: 'YANGDO' },
    update: {},
    create: {
      name: '양도코리아',
      code: 'YANGDO',
    }
  });

  const backofficeClient = await prisma.client.upsert({
    where: { code: 'BACKOFFICE' },
    update: {},
    create: {
      name: '백오피스',
      code: 'BACKOFFICE',
    }
  });

  const infraClient = await prisma.client.upsert({
    where: { code: 'INFRA' },
    update: {},
    create: {
      name: '사내 전산 인프라 구축',
      code: 'INFRA',
    }
  });

  const pmsClient = await prisma.client.upsert({
    where: { code: 'PMS' },
    update: {},
    create: {
      name: '프로젝트 관리',
      code: 'PMS',
    }
  });

  console.log('Clients created');

  // Create projects
  const projects = [
    {
      name: '이택스코리아(유지관리)',
      clientId: etaxkoreaClient.id,
      order: 1,
    },
    {
      name: '이택스코리아(차세대)',
      clientId: etaxkoreaClient.id,
      order: 2,
    },
    {
      name: '양도코리아(유지관리)',
      clientId: yangdoClient.id,
      order: 3,
    },
    {
      name: '양도코리아(차세대)',
      clientId: yangdoClient.id,
      order: 4,
    },
    {
      name: '백오피스(차세대 통합)',
      clientId: backofficeClient.id,
      order: 5,
    },
    {
      name: '사내 전산 인프라 구축(차세대)',
      clientId: infraClient.id,
      order: 6,
    },
    {
      name: '프로젝트 관리(차세대)',
      clientId: pmsClient.id,
      order: 7,
    },
  ];

  for (const project of projects) {
    await prisma.item.create({
      data: {
        type: ItemType.PROJECT,
        name: project.name,
        status: ItemStatus.IN_PROGRESS,
        progress: 0,
        clientId: project.clientId,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: project.order,
      }
    });
    console.log(`Created project: ${project.name}`);
  }

  console.log('All projects created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
