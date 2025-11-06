import { PrismaClient, ItemType, ItemStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to insert team actions...');

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
  console.log('Found users:', Array.from(userMap.keys()));

  // 프로젝트와 서비스 찾기
  const projects = await prisma.item.findMany({
    where: {
      type: ItemType.PROJECT,
      name: {
        in: [
          '이택스코리아(차세대)',
          '이택스코리아(유지관리)',
          '백오피스(차세대 통합)',
          '양도코리아(유지관리)',
          'tax114 유지보수'
        ]
      }
    },
    include: {
      other_Item: {
        where: {
          type: ItemType.SERVICE
        }
      }
    }
  });

  console.log('Found projects:', projects.map(p => p.name));

  // 프로젝트명 매핑 (데이터의 프로젝트명 -> 실제 DB의 프로젝트명)
  const projectNameMap: Record<string, string> = {
    '이택스코리아(차세대)': '이택스코리아(차세대)',
    '이택스코리아(유지보수)': '이택스코리아(유지관리)',
    '백오피스(차세대)': '백오피스(차세대 통합)',
    '양도코리아(유지보수)': '양도코리아(유지관리)',
    'tax114 유지보수': 'tax114 유지보수'
  };

  // 액션 데이터
  const actions = [
    // 이택스코리아(차세대) - 워크스페이스 - 백오피스
    {
      project: '이택스코리아(차세대)',
      service: '워크스페이스 - 백오피스',
      name: '그룹/공통코드 검색 API 필터 조건 추가 (생성일, 수정일 범위검색)',
      assignee: '정희찬',
      startDate: '2025-09-24',
      endDate: '2025-09-24',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    {
      project: '이택스코리아(차세대)',
      service: '워크스페이스 - 백오피스',
      name: '그룹/공통코드 검색 API 응답값에 마지막 수정자 ID 추가',
      assignee: '정희찬',
      startDate: '2025-09-24',
      endDate: '2025-09-24',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    {
      project: '이택스코리아(차세대)',
      service: '워크스페이스 - 백오피스',
      name: '백오피스 → 멤버십 서비스 간 통신 문제 해결 및 문제점 공유',
      assignee: '정희찬',
      startDate: '2025-09-25',
      endDate: '2025-09-25',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    {
      project: '이택스코리아(차세대)',
      service: '워크스페이스 - 백오피스',
      name: '워크스페이스·액션·권한 API 응답 스펙 수정',
      assignee: '정희찬',
      startDate: '2025-10-01',
      endDate: '2025-10-01',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    {
      project: '이택스코리아(차세대)',
      service: '워크스페이스 - 백오피스',
      name: '임시데이터 정리 및 마지막 수정자 로직 보강',
      assignee: '정희찬',
      startDate: '2025-10-01',
      endDate: '2025-10-01',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    {
      project: '이택스코리아(차세대)',
      service: '워크스페이스 - 백오피스',
      name: '워크스페이스명 중복 체크 로직 추가',
      assignee: '정희찬',
      startDate: '2025-10-03',
      endDate: '2025-10-03',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    {
      project: '이택스코리아(차세대)',
      service: '워크스페이스 - 백오피스',
      name: 'API 개발 (사용자, 워크스페이스, 액션)',
      assignee: '송준원',
      startDate: '2025-04-01',
      endDate: null,
      status: ItemStatus.ON_HOLD,
      progress: 50
    },
    // 이택스코리아(차세대) - 검색엔진
    {
      project: '이택스코리아(차세대)',
      service: '검색엔진',
      name: '문서 1줄 요약 (LLM 기반 제목 추출)',
      assignee: '정희찬',
      startDate: '2025-09-12',
      endDate: '2025-09-30',
      status: ItemStatus.IN_PROGRESS,
      progress: 70
    },
    {
      project: '이택스코리아(차세대)',
      service: '검색엔진',
      name: '예판문서 세목 분류 프롬프트 작업',
      assignee: '정희찬',
      startDate: '2025-10-14',
      endDate: '2025-10-14',
      status: ItemStatus.IN_PROGRESS,
      progress: 60
    },
    {
      project: '이택스코리아(차세대)',
      service: '검색엔진',
      name: '예규/판례 요약용 프롬프트 작성 및 품질 검토',
      assignee: '김예인',
      startDate: '2025-10-14',
      endDate: '2025-10-16',
      status: ItemStatus.IN_PROGRESS,
      progress: 65
    },
    // 이택스코리아(차세대) - 예판 문서
    {
      project: '이택스코리아(차세대)',
      service: '예판 문서',
      name: 'AS-IS 예판 문서 id 채번',
      assignee: '정희찬',
      startDate: '2025-09-15',
      endDate: '2025-09-19',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    {
      project: '이택스코리아(차세대)',
      service: '예판 문서',
      name: '조세심판원 문서 크롤링',
      assignee: '정희찬',
      startDate: '2025-09-22',
      endDate: '2025-10-02',
      status: ItemStatus.IN_PROGRESS,
      progress: 75
    },
    // 이택스코리아(차세대) - dwlf-starter
    {
      project: '이택스코리아(차세대)',
      service: 'dwlf-starter',
      name: '감사정보(Auditing) 시스템 개선',
      assignee: '김예인',
      startDate: '2025-09-25',
      endDate: '2025-09-26',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    // 이택스코리아(차세대) - 전체 서비스 영역
    {
      project: '이택스코리아(차세대)',
      service: '전체 서비스 영역',
      name: 'Feign Client 설정 보완',
      assignee: '김예인',
      startDate: '2025-10-02',
      endDate: '2025-10-14',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    // 이택스코리아(유지관리) - 결제 모듈 변경
    {
      project: '이택스코리아(유지보수)',
      service: '결제 모듈 변경',
      name: '빌링키 방식 결제 프로세스 설계',
      assignee: '김예인',
      startDate: '2025-09-23',
      endDate: '2025-09-25',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    {
      project: '이택스코리아(유지보수)',
      service: '결제 모듈 변경',
      name: '구독 결제 변경',
      assignee: '김예인',
      startDate: null,
      endDate: null,
      status: ItemStatus.NOT_STARTED,
      progress: 0
    },
    {
      project: '이택스코리아(유지보수)',
      service: '결제 모듈 변경',
      name: '토스페이먼츠 결제 모듈 연동',
      assignee: '송준원',
      startDate: '2025-08-25',
      endDate: null,
      status: ItemStatus.IN_PROGRESS,
      progress: 60
    },
    // 백오피스(차세대) - 멤버십 서비스
    {
      project: '백오피스(차세대)',
      service: '멤버십 서비스',
      name: 'LDAP 인증 시스템 최적화',
      assignee: '김예인',
      startDate: '2025-10-01',
      endDate: '2025-10-01',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    {
      project: '백오피스(차세대)',
      service: '멤버십 서비스',
      name: '백오피스 관리자 로그인 프로세스 개선',
      assignee: '김예인',
      startDate: '2025-09-29',
      endDate: '2025-10-01',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    {
      project: '백오피스(차세대)',
      service: '멤버십 서비스',
      name: 'JWT 사용자 정보 확장',
      assignee: '김예인',
      startDate: '2025-09-25',
      endDate: '2025-09-29',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    {
      project: '백오피스(차세대)',
      service: '멤버십 서비스',
      name: '테스트용 토큰 생성',
      assignee: '김예인',
      startDate: '2025-10-01',
      endDate: '2025-10-02',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    {
      project: '백오피스(차세대)',
      service: '멤버십 서비스',
      name: 'API 문서화 시스템 개선',
      assignee: '김예인',
      startDate: '2025-09-23',
      endDate: '2025-09-24',
      status: ItemStatus.COMPLETED,
      progress: 100
    },
    // 백오피스(차세대) - 관리자툴
    {
      project: '백오피스(차세대)',
      service: '관리자툴',
      name: '백오피스 메뉴 및 역할 API 개발',
      assignee: '박현명',
      startDate: '2025-08-01',
      endDate: '2025-10-01',
      status: ItemStatus.IN_PROGRESS,
      progress: 80
    },
    // 양도코리아(유지관리) - 상속·증여 부동산평가액 비교
    {
      project: '양도코리아(유지보수)',
      service: '상속·증여 부동산평가액 비교',
      name: '효산 API 고시가액 통신 개발 및 신규 화면 개발',
      assignee: '박현명',
      startDate: '2025-09-04',
      endDate: '2025-10-24',
      status: ItemStatus.IN_PROGRESS,
      progress: 90
    },
    // tax114 유지보수 - tax114
    {
      project: 'tax114 유지보수',
      service: 'tax114',
      name: '로직 변경, 문구 변경, 표 추가 삽입',
      assignee: '송준원',
      startDate: '2025-09-18',
      endDate: '2025-09-22',
      status: ItemStatus.IN_PROGRESS,
      progress: 70
    },
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const actionData of actions) {
    // 프로젝트 찾기
    const project = projects.find(p => p.name === actionData.project);
    if (!project) {
      console.log(`프로젝트를 찾을 수 없습니다: ${actionData.project}`);
      skippedCount++;
      continue;
    }

    // 서비스 찾기
    const service = project.other_Item.find((s: any) => s.name === actionData.service);
    if (!service) {
      console.log(`서비스를 찾을 수 없습니다: ${actionData.service} (프로젝트: ${actionData.project})`);
      skippedCount++;
      continue;
    }

    // 서비스의 개발팀 TEAM 항목 찾기
    const teamItem = await prisma.item.findFirst({
      where: {
        type: ItemType.TEAM,
        name: '개발팀',
        parentId: service.id
      }
    });

    if (!teamItem) {
      console.log(`개발팀 TEAM 항목을 찾을 수 없습니다: 서비스 ${actionData.service}`);
      skippedCount++;
      continue;
    }

    // 담당자 찾기
    const assignee = userMap.get(actionData.assignee);
    if (!assignee) {
      console.log(`담당자를 찾을 수 없습니다: ${actionData.assignee}`);
      skippedCount++;
      continue;
    }

    // 중복 체크
    const existing = await prisma.item.findFirst({
      where: {
        name: actionData.name,
        type: ItemType.ACTION,
        parentId: teamItem.id
      }
    });

    if (existing) {
      console.log(`이미 존재하는 액션: ${actionData.name}`);
      skippedCount++;
      continue;
    }

    // 액션 생성
    try {
      await prisma.item.create({
        data: {
          id: randomUUID(),
          type: ItemType.ACTION,
          name: actionData.name,
          status: actionData.status,
          progress: actionData.progress,
          startDate: actionData.startDate ? new Date(actionData.startDate) : null,
          endDate: actionData.endDate ? new Date(actionData.endDate) : null,
          parentId: teamItem.id,
          clientId: project.clientId,
          assigneeId: assignee.id,
          createdById: assignee.id,
          updatedAt: new Date()
        }
      });

      console.log(`✓ 액션 생성: ${actionData.name} (담당자: ${actionData.assignee})`);
      createdCount++;
    } catch (error) {
      console.error(`액션 생성 실패: ${actionData.name}`, error);
      skippedCount++;
    }
  }

  console.log('\n=== 완료 ===');
  console.log(`생성: ${createdCount}개`);
  console.log(`스킵: ${skippedCount}개`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
