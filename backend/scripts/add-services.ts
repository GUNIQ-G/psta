import { PrismaClient, ItemType, ItemStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Removing old services and adding new services...');

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

  // Delete all SERVICE, TEAM, ACTION items (keep only PROJECT)
  await prisma.item.deleteMany({
    where: {
      type: {
        in: [ItemType.SERVICE, ItemType.TEAM, ItemType.ACTION]
      }
    }
  });
  console.log('Old services/teams/actions deleted');

  // Get all projects
  const projects = await prisma.item.findMany({
    where: {
      type: ItemType.PROJECT,
      clientId: dzTechWillClient.id,
    },
    orderBy: { order: 'asc' }
  });

  console.log(`Found ${projects.length} projects`);

  // Update project dates and create services
  for (const project of projects) {
    let services: Array<{ name: string; startDate: string; endDate: string; order: number }> = [];
    let projectStartDate = '2025-01-01';
    let projectEndDate = '2025-12-31';

    switch (project.name) {
      case '이택스코리아(유지관리)':
        projectStartDate = '2025-01-01';
        projectEndDate = '2025-12-31';
        services = [
          { name: '결제 모듈', startDate: '2025-09-01', endDate: '2025-12-31', order: 1 },
          { name: '기타', startDate: '2025-01-01', endDate: '2025-12-31', order: 2 },
        ];
        break;

      case '이택스코리아(차세대)':
        projectStartDate = '2025-05-01';
        projectEndDate = '2026-09-30';
        services = [
          { name: 'dwlf-sterter', startDate: '2025-05-01', endDate: '2025-10-31', order: 1 },
          { name: '공통', startDate: '2025-01-01', endDate: '2026-09-30', order: 2 },
        ];
        break;

      case '양도코리아(유지관리)':
        projectStartDate = '2025-01-01';
        projectEndDate = '2025-12-31';
        services = [
          { name: '상속 증여 부동산 평가액 비교', startDate: '2025-09-01', endDate: '2025-09-30', order: 1 },
        ];
        break;

      case '양도코리아(차세대)':
        projectStartDate = '2026-01-01';
        projectEndDate = '2026-12-31';
        services = [
          { name: '기타', startDate: '2026-01-01', endDate: '2026-12-31', order: 1 },
        ];
        break;

      case '백오피스(차세대 통합)':
        projectStartDate = '2025-05-01';
        projectEndDate = '2026-09-30';
        services = [
          { name: '멤버십', startDate: '2025-08-01', endDate: '2025-10-31', order: 1 },
          { name: '게이트웨이', startDate: '2025-09-01', endDate: '2025-10-15', order: 2 },
          { name: '공통', startDate: '2025-05-01', endDate: '2026-09-30', order: 3 },
          { name: '관리자', startDate: '2025-05-01', endDate: '2025-11-30', order: 4 },
          { name: '워크스페이스', startDate: '2025-05-01', endDate: '2025-10-31', order: 5 },
        ];
        break;

      case '사내 전산 인프라 구축(차세대)':
        projectStartDate = '2025-09-09';
        projectEndDate = '2025-12-31';
        services = [
          { name: '인프라 현황 분석', startDate: '2025-09-09', endDate: '2025-09-19', order: 1 },
          { name: '차세대 인프라 구축', startDate: '2025-09-19', endDate: '2025-12-31', order: 2 },
          { name: '인프라 관리 솔루션 테스트', startDate: '2025-09-15', endDate: '2025-10-31', order: 3 },
          { name: '인프라 구성 표준 및 정책 문서화', startDate: '2025-09-09', endDate: '2025-11-30', order: 4 },
          { name: '인프라 보안 정책 및 표준 문서화', startDate: '2025-09-09', endDate: '2025-12-31', order: 5 },
        ];
        break;

      case '프로젝트 관리(차세대)':
        projectStartDate = '2025-09-30';
        projectEndDate = '2025-10-15';
        services = [
          { name: '신규 PMS 솔루션 도입 제안', startDate: '2025-10-01', endDate: '2025-10-02', order: 1 },
          { name: '프로젝트 관리를 위한 프레임워크 개발', startDate: '2025-10-01', endDate: '2025-10-31', order: 2 },
        ];
        break;
    }

    // Update project dates
    await prisma.item.update({
      where: { id: project.id },
      data: {
        startDate: new Date(projectStartDate),
        endDate: new Date(projectEndDate),
      }
    });

    console.log(`Updated project ${project.name} dates: ${projectStartDate} ~ ${projectEndDate}`);

    // Create services
    for (const service of services) {
      await prisma.item.create({
        data: {
          type: ItemType.SERVICE,
          name: service.name,
          status: ItemStatus.IN_PROGRESS,
          progress: 0,
          startDate: new Date(service.startDate),
          endDate: new Date(service.endDate),
          clientId: dzTechWillClient.id,
          parentId: project.id,
          createdById: adminUser.id,
          assigneeId: adminUser.id,
          order: service.order,
        }
      });
    }

    console.log(`  ✓ Added ${services.length} services to ${project.name}`);
  }

  console.log('All services added successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
