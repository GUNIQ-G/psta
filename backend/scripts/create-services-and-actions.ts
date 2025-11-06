import { PrismaClient, ItemType, ItemStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('서비스 및 액션 생성 시작...\n');

  // admin 사용자 찾기 (서비스 생성자로 사용)
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (!admin) {
    console.error('Admin 사용자를 찾을 수 없습니다.');
    return;
  }

  // 개발팀 찾기
  const devTeam = await prisma.team.findFirst({
    where: { name: '개발팀' }
  });

  if (!devTeam) {
    console.error('개발팀을 찾을 수 없습니다.');
    return;
  }

  // 사용자 찾기
  const users = await prisma.user.findMany({
    where: {
      displayName: {
        in: ['정희찬', '김예인', '송준원', '박현명']
      }
    }
  });

  const userMap = new Map(users.map(u => [u.displayName, u]));
  console.log('사용자 확인:', Array.from(userMap.keys()), '\n');

  // 서비스 및 액션 데이터 정의
  const serviceActionsMap: Record<string, any> = {
    '이택스코리아(차세대)': [
      {
        serviceName: '워크스페이스 - 백오피스',
        actions: [
          { name: '그룹/공통코드 검색 API 필터 조건 추가 (생성일, 수정일 범위검색)', assignee: '정희찬', start: '2025-09-24', end: '2025-09-24', status: ItemStatus.COMPLETED, progress: 100 },
          { name: '그룹/공통코드 검색 API 응답값에 마지막 수정자 ID 추가', assignee: '정희찬', start: '2025-09-24', end: '2025-09-24', status: ItemStatus.COMPLETED, progress: 100 },
          { name: '백오피스 → 멤버십 서비스 간 통신 문제 해결 및 문제점 공유', assignee: '정희찬', start: '2025-09-25', end: '2025-09-25', status: ItemStatus.COMPLETED, progress: 100 },
          { name: '워크스페이스·액션·권한 API 응답 스펙 수정', assignee: '정희찬', start: '2025-10-01', end: '2025-10-01', status: ItemStatus.COMPLETED, progress: 100 },
          { name: '임시데이터 정리 및 마지막 수정자 로직 보강', assignee: '정희찬', start: '2025-10-01', end: '2025-10-01', status: ItemStatus.COMPLETED, progress: 100 },
          { name: '워크스페이스명 중복 체크 로직 추가', assignee: '정희찬', start: '2025-10-03', end: '2025-10-03', status: ItemStatus.COMPLETED, progress: 100 },
          { name: 'API 개발 (사용자, 워크스페이스, 액션)', assignee: '송준원', start: '2025-04-01', end: null, status: ItemStatus.ON_HOLD, progress: 50 },
        ]
      },
      {
        serviceName: '검색엔진',
        actions: [
          { name: '문서 1줄 요약 (LLM 기반 제목 추출)', assignee: '정희찬', start: '2025-09-12', end: '2025-09-30', status: ItemStatus.IN_PROGRESS, progress: 70 },
          { name: '예판문서 세목 분류 프롬프트 작업', assignee: '정희찬', start: '2025-10-14', end: '2025-10-14', status: ItemStatus.IN_PROGRESS, progress: 60 },
          { name: '예규/판례 요약용 프롬프트 작성 및 품질 검토', assignee: '김예인', start: '2025-10-14', end: '2025-10-16', status: ItemStatus.IN_PROGRESS, progress: 65 },
        ]
      },
      {
        serviceName: '예판 문서',
        actions: [
          { name: 'AS-IS 예판 문서 id 채번', assignee: '정희찬', start: '2025-09-15', end: '2025-09-19', status: ItemStatus.COMPLETED, progress: 100 },
          { name: '조세심판원 문서 크롤링', assignee: '정희찬', start: '2025-09-22', end: '2025-10-02', status: ItemStatus.IN_PROGRESS, progress: 75 },
        ]
      },
      {
        serviceName: 'dwlf-starter',
        actions: [
          { name: '감사정보(Auditing) 시스템 개선', assignee: '김예인', start: '2025-09-25', end: '2025-09-26', status: ItemStatus.COMPLETED, progress: 100 },
        ]
      },
      {
        serviceName: '전체 서비스 영역',
        actions: [
          { name: 'Feign Client 설정 보완', assignee: '김예인', start: '2025-10-02', end: '2025-10-14', status: ItemStatus.COMPLETED, progress: 100 },
        ]
      },
    ],
    '이택스코리아(유지관리)': [
      {
        serviceName: '결제 모듈 변경',
        actions: [
          { name: '빌링키 방식 결제 프로세스 설계', assignee: '김예인', start: '2025-09-23', end: '2025-09-25', status: ItemStatus.COMPLETED, progress: 100 },
          { name: '구독 결제 변경', assignee: '김예인', start: null, end: null, status: ItemStatus.NOT_STARTED, progress: 0 },
          { name: '토스페이먼츠 결제 모듈 연동', assignee: '송준원', start: '2025-08-25', end: null, status: ItemStatus.IN_PROGRESS, progress: 60 },
        ]
      },
    ],
    '통합백오피스(차세대)': [
      {
        serviceName: '멤버십 서비스',
        actions: [
          { name: 'LDAP 인증 시스템 최적화', assignee: '김예인', start: '2025-10-01', end: '2025-10-01', status: ItemStatus.COMPLETED, progress: 100 },
          { name: '백오피스 관리자 로그인 프로세스 개선', assignee: '김예인', start: '2025-09-29', end: '2025-10-01', status: ItemStatus.COMPLETED, progress: 100 },
          { name: 'JWT 사용자 정보 확장', assignee: '김예인', start: '2025-09-25', end: '2025-09-29', status: ItemStatus.COMPLETED, progress: 100 },
          { name: '테스트용 토큰 생성', assignee: '김예인', start: '2025-10-01', end: '2025-10-02', status: ItemStatus.COMPLETED, progress: 100 },
          { name: 'API 문서화 시스템 개선', assignee: '김예인', start: '2025-09-23', end: '2025-09-24', status: ItemStatus.COMPLETED, progress: 100 },
        ]
      },
      {
        serviceName: '관리자툴',
        actions: [
          { name: '백오피스 메뉴 및 역할 API 개발', assignee: '박현명', start: '2025-08-01', end: '2025-10-01', status: ItemStatus.IN_PROGRESS, progress: 80 },
        ]
      },
    ],
    '양도코리아(유지관리)': [
      {
        serviceName: '상속·증여 부동산평가액 비교',
        actions: [
          { name: '효산 API 고시가액 통신 개발 및 신규 화면 개발', assignee: '박현명', start: '2025-09-04', end: '2025-10-24', status: ItemStatus.IN_PROGRESS, progress: 90 },
        ]
      },
    ],
  };

  // tax114 프로젝트 별도 처리 (이름이 다름)
  const tax114Actions = {
    projectName: 'tax114 유지보수',
    services: [
      {
        serviceName: 'tax114',
        actions: [
          { name: '로직 변경, 문구 변경, 표 추가 삽입', assignee: '송준원', start: '2025-09-18', end: '2025-09-22', status: ItemStatus.IN_PROGRESS, progress: 70 },
        ]
      },
    ]
  };

  let serviceCreated = 0;
  let actionCreated = 0;
  let skipped = 0;

  // 서비스 및 액션 생성
  for (const [projectName, services] of Object.entries(serviceActionsMap)) {
    const project = await prisma.item.findFirst({
      where: { type: ItemType.PROJECT, name: projectName }
    });

    if (!project) {
      console.log(`⚠ 프로젝트를 찾을 수 없습니다: ${projectName}`);
      continue;
    }

    console.log(`\n📁 프로젝트: ${projectName}`);

    for (const serviceData of services) {
      // 서비스 생성
      let service = await prisma.item.findFirst({
        where: {
          type: ItemType.SERVICE,
          name: serviceData.serviceName,
          parentId: project.id
        }
      });

      if (!service) {
        service = await prisma.item.create({
          data: {
            id: randomUUID(),
            type: ItemType.SERVICE,
            name: serviceData.serviceName,
            status: ItemStatus.NOT_STARTED,
            progress: 0,
            parentId: project.id,
            clientId: project.clientId,
            createdById: admin.id,
            updatedAt: new Date()
          }
        });
        console.log(`  ✓ 서비스 생성: ${serviceData.serviceName}`);
        serviceCreated++;
      } else {
        console.log(`  - 서비스 존재: ${serviceData.serviceName}`);
      }

      // 개발팀 TEAM 항목 생성 또는 찾기
      let teamItem = await prisma.item.findFirst({
        where: {
          type: ItemType.TEAM,
          name: '개발팀',
          parentId: service.id
        }
      });

      if (!teamItem) {
        teamItem = await prisma.item.create({
          data: {
            id: randomUUID(),
            type: ItemType.TEAM,
            name: '개발팀',
            status: ItemStatus.NOT_STARTED,
            progress: 0,
            parentId: service.id,
            clientId: project.clientId,
            createdById: admin.id,
            updatedAt: new Date()
          }
        });
        console.log(`    ✓ 팀 생성: 개발팀`);
      }

      // 액션 생성
      for (const actionData of serviceData.actions) {
        const assignee = userMap.get(actionData.assignee);
        if (!assignee) {
          console.log(`    ⚠ 담당자를 찾을 수 없습니다: ${actionData.assignee}`);
          skipped++;
          continue;
        }

        const existing = await prisma.item.findFirst({
          where: {
            type: ItemType.ACTION,
            name: actionData.name,
            parentId: teamItem.id
          }
        });

        if (existing) {
          console.log(`    - 액션 존재: ${actionData.name}`);
          skipped++;
          continue;
        }

        await prisma.item.create({
          data: {
            id: randomUUID(),
            type: ItemType.ACTION,
            name: actionData.name,
            status: actionData.status,
            progress: actionData.progress,
            startDate: actionData.start ? new Date(actionData.start) : null,
            endDate: actionData.end ? new Date(actionData.end) : null,
            parentId: teamItem.id,
            clientId: project.clientId,
            assigneeId: assignee.id,
            createdById: assignee.id,
            updatedAt: new Date()
          }
        });

        console.log(`    ✓ 액션 생성: ${actionData.name} (${actionData.assignee})`);
        actionCreated++;
      }
    }
  }

  console.log('\n=== 완료 ===');
  console.log(`서비스 생성: ${serviceCreated}개`);
  console.log(`액션 생성: ${actionCreated}개`);
  console.log(`스킵: ${skipped}개`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
