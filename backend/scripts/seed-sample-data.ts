import { PrismaClient, ItemType, ItemStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting sample data seeding...');

  // Get admin user
  const adminUser = await prisma.user.findFirst({
    where: { username: 'admin' }
  });

  if (!adminUser) {
    console.error('Admin user not found. Please login first.');
    return;
  }

  // Create client
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

  const dzBizschoolClient = await prisma.client.upsert({
    where: { code: 'DZ_BIZSCHOOL' },
    update: {},
    create: {
      name: '더존비즈스쿨',
      code: 'DZ_BIZSCHOOL',
    }
  });

  const diagnosisClient = await prisma.client.upsert({
    where: { code: 'DIAGNOSIS' },
    update: {},
    create: {
      name: '기업진단서류',
      code: 'DIAGNOSIS',
    }
  });

  const dzTechWillClient = await prisma.client.upsert({
    where: { code: 'DZ_TECHWILL' },
    update: {},
    create: {
      name: '더존테크윌 차세대 IT 인프라 개선',
      code: 'DZ_TECHWILL',
    }
  });

  const pmsClient = await prisma.client.upsert({
    where: { code: 'PMS' },
    update: {},
    create: {
      name: '프로젝트 관리 개선',
      code: 'PMS',
    }
  });

  console.log('Clients created');

  // 이택스코리아 데이터
  const etaxProject1 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '유지보수',
      status: ItemStatus.IN_PROGRESS,
      progress: 45,
      clientId: etaxkoreaClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  const etaxService1 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '결제 모듈 변경',
      status: ItemStatus.IN_PROGRESS,
      progress: 60,
      clientId: etaxkoreaClient.id,
      parentId: etaxProject1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  const etaxTeam1 = await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '결제 전환',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: etaxkoreaClient.id,
      parentId: etaxService1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '토스페이먼츠 결제 PG 연동',
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.ACTION,
      name: '인프라 구성 가능 여부 분석',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: etaxkoreaClient.id,
      parentId: etaxTeam1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.ACTION,
      name: 'CMS 및 API 사용에 대한 교육 미팅 요청',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: etaxkoreaClient.id,
      parentId: etaxTeam1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  const etaxTeam2 = await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '빌링키 방식 결제 프로세스 설계',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: etaxkoreaClient.id,
      parentId: etaxService1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '산출물 공유 완료',
      order: 2,
    }
  });

  const etaxTeam3 = await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: 'CMS 관련 문의',
      status: ItemStatus.IN_PROGRESS,
      progress: 30,
      clientId: etaxkoreaClient.id,
      parentId: etaxService1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '토스페이먼츠 응답 대기',
      order: 3,
    }
  });

  const etaxService2 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '기타',
      status: ItemStatus.IN_PROGRESS,
      progress: 70,
      clientId: etaxkoreaClient.id,
      parentId: etaxProject1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: 'DB 분석',
      status: ItemStatus.IN_PROGRESS,
      progress: 40,
      clientId: etaxkoreaClient.id,
      parentId: etaxService2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '예시코드 및 PHP 적용',
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '인쇄 팝업창 403 에러 문제 해결',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: etaxkoreaClient.id,
      parentId: etaxService2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  const etaxTeam4 = await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '예판 평점시스템',
      status: ItemStatus.IN_PROGRESS,
      progress: 80,
      clientId: etaxkoreaClient.id,
      parentId: etaxService2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 3,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.ACTION,
      name: '개발 서버 내 예판요약서비스 작업',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: etaxkoreaClient.id,
      parentId: etaxTeam4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '서비스기획실 테스트 전 단계 (with 배강민 차장)',
      order: 1,
    }
  });

  // 이택스코리아 - 차세대 프로젝트
  const etaxProject2 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '차세대 프로젝트',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: etaxkoreaClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  const etaxService3 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'dwlf-sterter',
      status: ItemStatus.IN_PROGRESS,
      progress: 100,
      clientId: etaxkoreaClient.id,
      parentId: etaxProject2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '감사정보(Auditing) 시스템 개선',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: etaxkoreaClient.id,
      parentId: etaxService3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: 'createBY, updateBy 필드 자동 설정 기능 구현',
      order: 1,
    }
  });

  const etaxService4 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'Core',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: etaxkoreaClient.id,
      parentId: etaxProject2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: 'Feign Client 설정 보완',
      status: ItemStatus.IN_PROGRESS,
      progress: 40,
      clientId: etaxkoreaClient.id,
      parentId: etaxService4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '각 서비스 간 feign 으로 호출했을 때 예외처리 정책, 응답 정책이 필요함',
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '백오피스와 통신 문제 해결 및 기존 문제점 공유',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: etaxkoreaClient.id,
      parentId: etaxService4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  console.log('이택스코리아 data created');

  // 양도코리아
  const yangdoProject1 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '유지보수',
      status: ItemStatus.IN_PROGRESS,
      progress: 30,
      clientId: yangdoClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '상속 증여 부동산 평가액 비교',
      status: ItemStatus.IN_PROGRESS,
      progress: 30,
      clientId: yangdoClient.id,
      parentId: yangdoProject1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '효산 API 고시가액 데이터 통신 개발 및 신규화면 개발',
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '차세대',
      status: ItemStatus.ON_HOLD,
      progress: 0,
      clientId: yangdoClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '보류',
      order: 2,
    }
  });

  console.log('양도코리아 data created');

  // 백오피스
  const backofficeProject1 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '멤버십',
      status: ItemStatus.IN_PROGRESS,
      progress: 80,
      clientId: backofficeClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'LDAP 인증 시스템 최적화',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeProject1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: 'LDAP 권한 처리 로직 제거 및 중복 인증 제거',
      order: 1,
    }
  });

  const backofficeService2 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '백오피스 관리자 로그인 프로세스 개선',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeProject1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: 'USER 대신 MEMBER 도메인으로 통일',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeService2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '최초 로그인 프로세스 개선',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeService2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '도메인이 변경되어 그에 맞게 로그인 응답 필드 변경',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeService2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 3,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'API 문서화 시스템 개선',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeProject1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: 'RestDocs 문서화 오류 해결 및 APU 문서 정확성 향상 (RestDocs 스니펫 개선)',
      order: 3,
    }
  });

  // 백오피스 - 게이트웨이
  const backofficeProject2 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '게이트웨이',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  const backofficeService3 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'JWT 사용자 정보 확장',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeProject2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: 'JWT 토큰에 claim 추가',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeService3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: 'subject를 유일식별키로 변경',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeService3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: 'Gateway 헤더 자동 구성',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeService3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 3,
    }
  });

  // 백오피스 - Core
  const backofficeProject3 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: 'Core',
      status: ItemStatus.IN_PROGRESS,
      progress: 60,
      clientId: backofficeClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 3,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '테스트용 토큰 생성',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: backofficeClient.id,
      parentId: backofficeProject3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '정 생성하고 인증증없이 바로 테스트 토큰을 발급할 수 있는 api 제공 예정',
      order: 1,
    }
  });

  const backofficeService4 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '그룹/공통코드 검색 API',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeProject3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '필터 조건추가',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeService4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '생성일, 수정일 범위 검색',
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '응답값 마지막 수정자 ID 추가',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeService4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  const backofficeService5 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '기존 임시데이터들 정리',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeProject3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 3,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '생성자, 수정자 컬럼에 더미데이터 들어가있던 것들 SYSTEM으로 수정',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeService5.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '마지막 수정자 ID 조회 로직 보강',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeService5.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  // 백오피스 - 관리자
  const backofficeProject4 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '관리자',
      status: ItemStatus.IN_PROGRESS,
      progress: 40,
      clientId: backofficeClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 4,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '백오피스 관리자 툴',
      status: ItemStatus.IN_PROGRESS,
      progress: 40,
      clientId: backofficeClient.id,
      parentId: backofficeProject4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '백오피스 메뉴 및 역할 API 개발',
      order: 1,
    }
  });

  // 백오피스 - 워크스페이스
  const backofficeProject5 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '워크스페이스',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 5,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '이택스코리아의 액션, 권한 API 응답 스펙 수정',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: backofficeClient.id,
      parentId: backofficeProject5.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  console.log('백오피스 data created');

  // 더존비즈스쿨
  await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '근로자주도훈련 교육 신청',
      status: ItemStatus.IN_PROGRESS,
      progress: 60,
      clientId: dzBizschoolClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '(신규 대상 추가) 테스트',
      order: 1,
    }
  });

  console.log('더존비즈스쿨 data created');

  // 기업진단서류
  await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '진단보고서 템플릿 변경',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: diagnosisClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  console.log('기업진단서류 data created');

  // 더존테크윌 차세대 IT 인프라 개선
  const dzTechProject1 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '인프라 현황 분석',
      status: ItemStatus.ON_HOLD,
      progress: 30,
      clientId: dzTechWillClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '서버 자산 파악',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: 'IDC 서버, 사내 전산실 서버, 클라우드 서버',
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '서버 구성 분석',
      status: ItemStatus.ON_HOLD,
      progress: 0,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: 'OS, WEB, APP, DBS, 그 외, 3rd party 솔루션 등',
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '네트워크 자산 파악',
      status: ItemStatus.ON_HOLD,
      progress: 0,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: 'AP, L2 SW, Modem, VPN 등',
      order: 3,
    }
  });

  const dzTechProject2 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '차세대 인프라 구축 (우선순위 B)',
      status: ItemStatus.IN_PROGRESS,
      progress: 40,
      clientId: dzTechWillClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  const dzTechService1 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'UPS 도입 제안',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '전력 유지 시스템 - 약 1시간',
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '업체 미팅 진행 완료',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: dzTechWillClient.id,
      parentId: dzTechService1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '견적서 회신 대기',
      status: ItemStatus.IN_PROGRESS,
      progress: 0,
      clientId: dzTechWillClient.id,
      parentId: dzTechService1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  const dzTechService2 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '통합 NW 장비 도입 제안',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '방화벽, L3, L2 등 특정 기능 통합적으로 한 Device에서 제공',
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '업체 미팅 진행 완료',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: dzTechWillClient.id,
      parentId: dzTechService2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '견적서 회신 대기',
      status: ItemStatus.IN_PROGRESS,
      progress: 0,
      clientId: dzTechWillClient.id,
      parentId: dzTechService2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  // 인프라 관리 솔루션 테스트
  const dzTechProject3 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '인프라 관리 솔루션 테스트',
      status: ItemStatus.IN_PROGRESS,
      progress: 60,
      clientId: dzTechWillClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 3,
    }
  });

  const dzTechService3 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '자산관리 시스템 (DZ helpdesk)',
      status: ItemStatus.IN_PROGRESS,
      progress: 70,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '설치',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: dzTechWillClient.id,
      parentId: dzTechService3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '테스트',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: dzTechWillClient.id,
      parentId: dzTechService3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '서버, 네트워크 등 자산 리스트 업로드',
      status: ItemStatus.IN_PROGRESS,
      progress: 40,
      clientId: dzTechWillClient.id,
      parentId: dzTechService3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 3,
    }
  });

  const dzTechService4 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '모니터링 시스템 (DZ MON)',
      status: ItemStatus.IN_PROGRESS,
      progress: 60,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '설치',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: dzTechWillClient.id,
      parentId: dzTechService4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '테스트',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: dzTechWillClient.id,
      parentId: dzTechService4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  const dzTechService5 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '접속관리 시스템 (DZ SACS)',
      status: ItemStatus.IN_PROGRESS,
      progress: 60,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject3.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 3,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '설치',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: dzTechWillClient.id,
      parentId: dzTechService5.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '테스트',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: dzTechWillClient.id,
      parentId: dzTechService5.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  // 인프라 구성 표준 및 정책 문서화
  const dzTechProject4 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '인프라 구성 표준 및 정책 문서화',
      status: ItemStatus.IN_PROGRESS,
      progress: 30,
      clientId: dzTechWillClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 4,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'OS 설치 및 설정 표준안 초안',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'Docker 설치 및 설정 표준안 초안',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'Web 설치 및 설정 표준안 초안',
      status: ItemStatus.NOT_STARTED,
      progress: 0,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 3,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'APP 설치 및 설정 표준안 초안',
      status: ItemStatus.NOT_STARTED,
      progress: 0,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 4,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'DBS 설치 및 설정 표준안 초안',
      status: ItemStatus.NOT_STARTED,
      progress: 0,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 5,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'hostname 작명 규칙 표준안 초안',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 6,
    }
  });

  const dzTechService6 = await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '더존테크윌 전체 인프라 구성도',
      status: ItemStatus.NOT_STARTED,
      progress: 0,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 7,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '이택스코리아 인프라 구성도',
      status: ItemStatus.NOT_STARTED,
      progress: 0,
      clientId: dzTechWillClient.id,
      parentId: dzTechService6.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.TEAM,
      name: '양도코리아 인프라 구성도',
      status: ItemStatus.NOT_STARTED,
      progress: 0,
      clientId: dzTechWillClient.id,
      parentId: dzTechService6.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '더존테크윌 네트워크 구성도',
      status: ItemStatus.NOT_STARTED,
      progress: 0,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject4.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 8,
    }
  });

  // 인프라 보안 정책 및 표준 문서화
  const dzTechProject5 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '인프라 보안 정책 및 표준 문서화',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: dzTechWillClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 5,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '인프라 자산 접속을 위한 계정 비밀번호 생성 규칙 표준안 초안',
      status: ItemStatus.COMPLETED,
      progress: 100,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject5.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'OS 보안 설정 표준 가이드 및 체크리스트',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: dzTechWillClient.id,
      parentId: dzTechProject5.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  console.log('더존테크윌 차세대 IT 인프라 개선 data created');

  // 프로젝트 관리 개선
  const pmsProject1 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '신규 PMS 솔루션 도입 제안',
      status: ItemStatus.IN_PROGRESS,
      progress: 40,
      clientId: pmsClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      description: '우선순위 A',
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: 'PMS 솔루션 시장 조사 및 기능 분석',
      status: ItemStatus.IN_PROGRESS,
      progress: 40,
      clientId: pmsClient.id,
      parentId: pmsProject1.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  const pmsProject2 = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      name: '프로젝트 관리를 위한 프레임워크 개발',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: pmsClient.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '문서화',
      status: ItemStatus.IN_PROGRESS,
      progress: 50,
      clientId: pmsClient.id,
      parentId: pmsProject2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 1,
    }
  });

  await prisma.item.create({
    data: {
      type: ItemType.SERVICE,
      name: '팀 내 교육',
      status: ItemStatus.NOT_STARTED,
      progress: 0,
      clientId: pmsClient.id,
      parentId: pmsProject2.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      order: 2,
    }
  });

  console.log('프로젝트 관리 개선 data created');

  console.log('Sample data seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
