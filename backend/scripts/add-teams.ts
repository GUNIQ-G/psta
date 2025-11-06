import { PrismaClient, ItemType, ItemStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding teams (services) to projects...');

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

  // Set dates
  const startDate = new Date('2025-01-01');
  const endDate = new Date('2025-12-31');

  // Get all projects
  const projects = await prisma.item.findMany({
    where: {
      type: ItemType.PROJECT,
      clientId: dzTechWillClient.id,
    },
    orderBy: { order: 'asc' }
  });

  console.log(`Found ${projects.length} projects`);

  // Define teams for each project
  const teamConfigs = {
    '사내 전산 인프라 구축(차세대)': ['인프라팀'],
    '프로젝트 관리(차세대)': ['기획팀'],
    // All other projects get all 4 teams
    'default': ['기획팀', '디자인팀', '개발팀', '인프라팀']
  };

  for (const project of projects) {
    let teams: string[];

    if (teamConfigs[project.name as keyof typeof teamConfigs]) {
      teams = teamConfigs[project.name as keyof typeof teamConfigs] as string[];
    } else {
      teams = teamConfigs['default'];
    }

    console.log(`Adding teams to ${project.name}: ${teams.join(', ')}`);

    let order = 1;
    for (const teamName of teams) {
      await prisma.item.create({
        data: {
          type: ItemType.SERVICE,
          name: teamName,
          status: ItemStatus.IN_PROGRESS,
          progress: 0,
          startDate: startDate,
          endDate: endDate,
          clientId: dzTechWillClient.id,
          parentId: project.id,
          createdById: adminUser.id,
          assigneeId: adminUser.id,
          order: order++,
        }
      });
    }

    console.log(`  ✓ Added ${teams.length} teams to ${project.name}`);
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
