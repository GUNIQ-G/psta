import { PrismaClient, ItemType, ItemStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

interface ProjectStructure {
  name: string;
  services: {
    name: string;
    teams: string[]; // Only 개발팀 and 디자인팀
  }[];
}

const projects: ProjectStructure[] = [
  {
    name: '이택스코리아(유지관리)',
    services: [
      { name: '결제 모듈', teams: ['개발팀', '디자인팀'] },
      { name: '기타', teams: ['개발팀', '디자인팀'] },
    ],
  },
  {
    name: '이택스코리아(차세대)',
    services: [
      { name: 'dwlf-sterter', teams: ['개발팀', '디자인팀'] },
      { name: '공통', teams: ['개발팀', '디자인팀'] },
    ],
  },
  {
    name: '양도코리아(유지관리)',
    services: [
      { name: '상속 증여 부동산 평가액 비교', teams: ['개발팀', '디자인팀'] },
    ],
  },
  {
    name: '양도코리아(차세대)',
    services: [
      { name: '기타', teams: ['개발팀', '디자인팀'] },
    ],
  },
  {
    name: '백오피스(차세대 통합)',
    services: [
      { name: '멤버십', teams: ['개발팀', '디자인팀'] },
      { name: '게이트웨이', teams: ['개발팀', '디자인팀'] },
      { name: '공통', teams: ['개발팀', '디자인팀'] },
      { name: '관리자', teams: ['개발팀', '디자인팀'] },
      { name: '워크스페이스', teams: ['개발팀', '디자인팀'] },
    ],
  },
  {
    name: '사내 전산 인프라 구축(차세대)',
    services: [
      { name: '인프라 현황 분석', teams: ['개발팀', '디자인팀'] },
      { name: '차세대 인프라 구축', teams: ['개발팀', '디자인팀'] },
      { name: '인프라 관리 솔루션 테스트', teams: ['개발팀', '디자인팀'] },
      { name: '인프라 구성 표준 및 정책 문서화', teams: ['개발팀', '디자인팀'] },
      { name: '인프라 보안 정책 및 표준 문서화', teams: ['개발팀', '디자인팀'] },
    ],
  },
  {
    name: '프로젝트 관리(차세대)',
    services: [
      { name: '신규 PMS 솔루션 도입 제안', teams: ['개발팀', '디자인팀'] },
      { name: '프로젝트 관리를 위한 프레임워크 개발', teams: ['개발팀', '디자인팀'] },
    ],
  },
];

// Action templates for different team types
const actionTemplates = {
  개발팀: [
    '기능 개발',
    '버그 수정',
    '코드 리뷰',
    'API 구현',
    '테스트 코드 작성',
    '성능 최적화',
  ],
  디자인팀: [
    'UI 디자인',
    'UX 개선',
    '프로토타입 제작',
    '디자인 시스템 구축',
    '사용자 테스트',
    '피드백 반영',
  ],
};

async function main() {
  console.log('🚀 Starting setup...\n');

  // Check and create client
  let client = await prisma.client.findFirst({
    where: { code: 'DZ_TECHWILL' },
  });

  if (!client) {
    console.log('📦 Creating client: 더존테크윌...');
    client = await prisma.client.create({
      data: {
        id: randomUUID(),
        name: '더존테크윌',
        code: 'DZ_TECHWILL',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log(`✅ Client created: ${client.name} (${client.code})\n`);
  } else {
    console.log(`📌 Found existing client: ${client.name} (${client.code})\n`);
  }

  // Get admin user
  const admin = await prisma.user.findFirst({
    where: { username: 'admin' },
  });

  if (!admin) {
    console.log('❌ Admin user not found');
    return;
  }

  // Get users for assignment
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      isVerified: true,
    },
  });

  console.log(`📌 Found ${users.length} active users for assignments\n`);

  // Clear existing items for this client
  const existingItems = await prisma.item.count({
    where: { clientId: client.id },
  });

  if (existingItems > 0) {
    console.log(`🧹 Clearing ${existingItems} existing items...`);
    await prisma.item.deleteMany({
      where: { clientId: client.id },
    });
    console.log('✅ Existing items cleared\n');
  }

  let projectCount = 0;
  let serviceCount = 0;
  let teamCount = 0;
  let actionCount = 0;

  console.log('🏗️  Creating project structure...\n');

  // Create projects, services, teams, and actions
  for (let pIdx = 0; pIdx < projects.length; pIdx++) {
    const projectData = projects[pIdx];

    const project = await prisma.item.create({
      data: {
        id: randomUUID(),
        type: ItemType.PROJECT,
        name: projectData.name,
        status: ItemStatus.IN_PROGRESS,
        progress: Math.floor(Math.random() * 30) + 20, // 20-50%
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        timeSpent: 0,
        order: pIdx,
        clientId: client.id,
        createdById: admin.id,
        updatedAt: new Date(),
      },
    });

    projectCount++;
    console.log(`✅ Created project: ${project.name}`);

    // Create services
    for (let sIdx = 0; sIdx < projectData.services.length; sIdx++) {
      const serviceData = projectData.services[sIdx];

      const service = await prisma.item.create({
        data: {
          id: randomUUID(),
          type: ItemType.SERVICE,
          name: serviceData.name,
          status: ItemStatus.IN_PROGRESS,
          progress: Math.floor(Math.random() * 40) + 20, // 20-60%
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          timeSpent: 0,
          order: sIdx,
          clientId: client.id,
          parentId: project.id,
          createdById: admin.id,
          updatedAt: new Date(),
        },
      });

      serviceCount++;
      console.log(`  ✅ Created service: ${service.name}`);

      // Create teams (only 개발팀 and 디자인팀)
      for (let tIdx = 0; tIdx < serviceData.teams.length; tIdx++) {
        const teamName = serviceData.teams[tIdx];

        const team = await prisma.item.create({
          data: {
            id: randomUUID(),
            type: ItemType.TEAM,
            name: teamName,
            status: ItemStatus.IN_PROGRESS,
            progress: Math.floor(Math.random() * 50) + 20, // 20-70%
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-12-31'),
            timeSpent: 0,
            order: tIdx,
            clientId: client.id,
            parentId: service.id,
            createdById: admin.id,
            updatedAt: new Date(),
          },
        });

        teamCount++;
        console.log(`    ✅ Created team: ${team.name}`);

        // Create 3-5 action items per team
        const numActions = Math.floor(Math.random() * 3) + 3; // 3-5 actions
        const templates = actionTemplates[teamName as keyof typeof actionTemplates] || actionTemplates['개발팀'];

        for (let aIdx = 0; aIdx < numActions; aIdx++) {
          const actionName = templates[aIdx % templates.length];

          // Random status distribution
          const rand = Math.random();
          let status: ItemStatus;
          let progress: number;

          if (rand < 0.3) {
            // 30% IN_PROGRESS
            status = ItemStatus.IN_PROGRESS;
            progress = Math.floor(Math.random() * 50) + 30; // 30-80%
          } else if (rand < 0.5) {
            // 20% COMPLETED
            status = ItemStatus.COMPLETED;
            progress = 100;
          } else if (rand < 0.6) {
            // 10% ON_HOLD
            status = ItemStatus.ON_HOLD;
            progress = Math.floor(Math.random() * 30) + 10; // 10-40%
          } else {
            // 40% NOT_STARTED
            status = ItemStatus.NOT_STARTED;
            progress = 0;
          }

          // Assign to random user
          const assignee = users[Math.floor(Math.random() * users.length)];

          // Random dates within 2025
          const startMonth = Math.floor(Math.random() * 10) + 1; // 1-10
          const durationMonths = Math.floor(Math.random() * 3) + 1; // 1-3 months
          const startDate = new Date(`2025-${startMonth.toString().padStart(2, '0')}-01`);
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + durationMonths);

          await prisma.item.create({
            data: {
              id: randomUUID(),
              type: ItemType.ACTION,
              name: `${actionName} ${aIdx + 1}`,
              status,
              progress,
              startDate,
              endDate,
              timeSpent: 0,
              order: aIdx,
              clientId: client.id,
              parentId: team.id,
              assigneeId: assignee.id,
              createdById: admin.id,
              updatedAt: new Date(),
            },
          });

          actionCount++;
        }

        console.log(`      ✅ Created ${numActions} actions for ${team.name}`);
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Client: ${client.name}`);
  console.log(`  Projects: ${projectCount}`);
  console.log(`  Services: ${serviceCount}`);
  console.log(`  Teams: ${teamCount}`);
  console.log(`  Actions: ${actionCount}`);
  console.log(`  Total Items: ${projectCount + serviceCount + teamCount + actionCount}`);
  console.log('\n✨ Sample data created successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
