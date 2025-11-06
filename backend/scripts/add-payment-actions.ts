import { PrismaClient, ItemType, ItemStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding actions to 결제 모듈 service...');

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

  // Find 결제 모듈 service
  const paymentService = await prisma.item.findFirst({
    where: {
      type: ItemType.SERVICE,
      name: '결제 모듈',
      clientId: dzTechWillClient.id,
    }
  });

  if (!paymentService) {
    console.error('결제 모듈 service not found');
    return;
  }

  console.log(`Found service: ${paymentService.name}`);

  // Create actions
  const actions = [
    {
      name: '결제 전환',
      description: '토스페이먼츠 결제 PG 연동\n- 인프라 구성 가능 여부 분석 (완료)\n- CMS 및 API 사용에 대한 교육 미팅 요청 (진행중)',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      order: 1,
    },
    {
      name: '빌링키 방식 결제 프로세스 설계',
      description: '산출물 공유 완료',
      status: ItemStatus.COMPLETED,
      progress: 100,
      order: 2,
    },
    {
      name: 'CMS 관련 문의',
      description: '토스페이먼츠 응답 대기',
      status: ItemStatus.IN_PROGRESS,
      progress: 30,
      order: 3,
    },
  ];

  for (const action of actions) {
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: action.name,
        description: action.description,
        status: action.status,
        progress: action.progress,
        startDate: paymentService.startDate,
        endDate: paymentService.endDate,
        clientId: dzTechWillClient.id,
        parentId: paymentService.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: action.order,
      }
    });
    console.log(`  ✓ Created action: ${action.name} (${action.status})`);
  }

  console.log('All actions added successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
