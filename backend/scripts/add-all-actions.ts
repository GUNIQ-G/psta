import { PrismaClient, ItemType, ItemStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding all actions...');

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

  // Date ranges
  const completedStart = new Date('2024-09-24');
  const completedEnd = new Date('2024-10-01');
  const inProgressStart = new Date('2024-10-01');
  const inProgressEnd = new Date('2024-10-08');

  // Helper function to find team
  const findTeam = async (serviceName: string, teamName: string) => {
    const service = await prisma.item.findFirst({
      where: {
        type: ItemType.SERVICE,
        name: serviceName,
        clientId: dzTechWillClient.id,
      }
    });

    if (!service) {
      console.error(`Service not found: ${serviceName}`);
      return null;
    }

    const team = await prisma.item.findFirst({
      where: {
        type: ItemType.TEAM,
        name: teamName,
        parentId: service.id,
      }
    });

    if (!team) {
      console.error(`Team not found: ${teamName} under ${serviceName}`);
      return null;
    }

    return team;
  };

  // Helper function to create action
  const createAction = async (
    serviceName: string,
    teamName: string,
    actionName: string,
    status: ItemStatus,
    description: string,
    order: number,
    hasSubActions: boolean = false
  ) => {
    const team = await findTeam(serviceName, teamName);
    if (!team) return null;

    let startDate = undefined;
    let endDate = undefined;
    let progress = 0;

    if (status === ItemStatus.COMPLETED) {
      startDate = completedStart;
      endDate = completedEnd;
      progress = 100;
    } else if (status === ItemStatus.IN_PROGRESS) {
      startDate = inProgressStart;
      endDate = inProgressEnd;
      progress = 50;
    } else if (status === ItemStatus.ON_HOLD) {
      progress = 0;
    }

    const action = await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: actionName,
        description: description,
        status: status,
        progress: progress,
        startDate: startDate,
        endDate: endDate,
        clientId: dzTechWillClient.id,
        parentId: team.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: order,
      }
    });

    console.log(`  ✓ Created action: ${actionName} (${status})`);
    return action;
  };

  // 이택스코리아(유지관리) - 기타 - 개발팀
  await createAction('기타', '개발팀', 'DB 분석', ItemStatus.IN_PROGRESS, '예시코드 및 PHP 적용', 1);
  await createAction('기타', '개발팀', '인쇄 팝업창 403 에러 문제 해결', ItemStatus.COMPLETED, '', 2);

  const team1 = await findTeam('기타', '개발팀');
  if (team1) {
    const parent1 = await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '예판 평점시스템',
        status: ItemStatus.IN_PROGRESS,
        progress: 80,
        startDate: inProgressStart,
        endDate: inProgressEnd,
        clientId: dzTechWillClient.id,
        parentId: team1.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 3,
      }
    });
    console.log('  ✓ Created action: 예판 평점시스템');

    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '개발 서버 내 예판요약서비스 작업',
        description: '서비스기획실 테스트 전 단계 (with 배강민 차장)',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent1.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    console.log('    ✓ Created sub-action: 개발 서버 내 예판요약서비스 작업');
  }

  // 이택스코리아(차세대) - dwlf-sterter - 개발팀
  await createAction('dwlf-sterter', '개발팀', '감사정보(Auditing) 시스템 개선', ItemStatus.COMPLETED, 'createBY, updateBy 필드 자동 설정 기능 구현', 1);

  // 이택스코리아(차세대) - 공통 - 개발팀
  await createAction('공통', '개발팀', 'Feign Client 설정 보완', ItemStatus.IN_PROGRESS, '각 서비스 간 feign 으로 호출했을 때 예외처리 정책, 응답 정책이 필요함', 1);
  await createAction('공통', '개발팀', '백오피스와 통신 문제 해결 및 기존 문제점 공유', ItemStatus.COMPLETED, '', 2);

  // 백오피스(차세대 통합) - 멤버십 - 개발팀
  await createAction('멤버십', '개발팀', 'LDAP 인증 시스템 최적화', ItemStatus.COMPLETED, 'LDAP 권한 처리 로직 제거 및 중복 인증 제거', 1);

  const team2 = await findTeam('멤버십', '개발팀');
  if (team2) {
    const parent2 = await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '백오피스 관리자 로그인 프로세스 개선',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: team2.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 2,
      }
    });
    console.log('  ✓ Created action: 백오피스 관리자 로그인 프로세스 개선');

    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: 'USER 대신 MEMBER 도메인으로 통일',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent2.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '최초 로그인 프로세스 개선',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent2.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 2,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '도메인이 변경되어 그에 맞게 로그인 응답 필드 변경',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent2.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 3,
      }
    });
    console.log('    ✓ Created 3 sub-actions');
  }

  await createAction('멤버십', '개발팀', 'API 문서화 시스템 개선', ItemStatus.COMPLETED, 'RestDocs 문서화 오류 해결 및 APU 문서 정확성 향상 (RestDocs 스니펫 개선)', 3);

  // 백오피스(차세대 통합) - 게이트웨이 - 개발팀
  const team3 = await findTeam('게이트웨이', '개발팀');
  if (team3) {
    const parent3 = await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: 'JWT 사용자 정보 확장',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: team3.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    console.log('  ✓ Created action: JWT 사용자 정보 확장');

    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: 'JWT 토큰에 claim 추가',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent3.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: 'subject를 유일식별키로 변경',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent3.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 2,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: 'Gateway 헤더 자동 구성',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent3.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 3,
      }
    });
    console.log('    ✓ Created 3 sub-actions');
  }

  // 백오피스(차세대 통합) - 공통 - 개발팀
  // Find the correct "공통" service (under 백오피스)
  const backofficeProject = await prisma.item.findFirst({
    where: {
      type: ItemType.PROJECT,
      name: '백오피스(차세대 통합)',
      clientId: dzTechWillClient.id,
    }
  });

  const backofficeCommon = await prisma.item.findFirst({
    where: {
      type: ItemType.SERVICE,
      name: '공통',
      parentId: backofficeProject?.id,
      clientId: dzTechWillClient.id,
    }
  });

  if (backofficeCommon) {
    const backofficeCommonDevTeam = await prisma.item.findFirst({
      where: {
        type: ItemType.TEAM,
        name: '개발팀',
        parentId: backofficeCommon.id,
      }
    });

    if (backofficeCommonDevTeam) {
      await prisma.item.create({
        data: {
          type: ItemType.ACTION,
          name: '테스트용 토큰 생성',
          description: '정 생성하고 인증증없이 바로 테스트 토큰을 발급할 수 있는 api 제공 예정',
          status: ItemStatus.IN_PROGRESS,
          progress: 50,
          startDate: inProgressStart,
          endDate: inProgressEnd,
          clientId: dzTechWillClient.id,
          parentId: backofficeCommonDevTeam.id,
          createdById: adminUser.id,
          assigneeId: adminUser.id,
          order: 1,
        }
      });
      console.log('  ✓ Created action: 테스트용 토큰 생성');

      const parent4 = await prisma.item.create({
        data: {
          type: ItemType.ACTION,
          name: '그룹/공통코드 검색 API',
          status: ItemStatus.COMPLETED,
          progress: 100,
          startDate: completedStart,
          endDate: completedEnd,
          clientId: dzTechWillClient.id,
          parentId: backofficeCommonDevTeam.id,
          createdById: adminUser.id,
          assigneeId: adminUser.id,
          order: 2,
        }
      });
      console.log('  ✓ Created action: 그룹/공통코드 검색 API');

      await prisma.item.create({
        data: {
          type: ItemType.ACTION,
          name: '필터 조건추가',
          description: '생성일, 수정일 범위 검색',
          status: ItemStatus.COMPLETED,
          progress: 100,
          startDate: completedStart,
          endDate: completedEnd,
          clientId: dzTechWillClient.id,
          parentId: parent4.id,
          createdById: adminUser.id,
          assigneeId: adminUser.id,
          order: 1,
        }
      });
      await prisma.item.create({
        data: {
          type: ItemType.ACTION,
          name: '응답값 마지막 수정자 ID 추가',
          status: ItemStatus.COMPLETED,
          progress: 100,
          startDate: completedStart,
          endDate: completedEnd,
          clientId: dzTechWillClient.id,
          parentId: parent4.id,
          createdById: adminUser.id,
          assigneeId: adminUser.id,
          order: 2,
        }
      });
      console.log('    ✓ Created 2 sub-actions');

      const parent5 = await prisma.item.create({
        data: {
          type: ItemType.ACTION,
          name: '기존 임시데이터들 정리',
          status: ItemStatus.COMPLETED,
          progress: 100,
          startDate: completedStart,
          endDate: completedEnd,
          clientId: dzTechWillClient.id,
          parentId: backofficeCommonDevTeam.id,
          createdById: adminUser.id,
          assigneeId: adminUser.id,
          order: 3,
        }
      });
      console.log('  ✓ Created action: 기존 임시데이터들 정리');

      await prisma.item.create({
        data: {
          type: ItemType.ACTION,
          name: '생성자, 수정자 컬럼에 더미데이터 들어가있던 것들 SYSTEM으로 수정',
          status: ItemStatus.COMPLETED,
          progress: 100,
          startDate: completedStart,
          endDate: completedEnd,
          clientId: dzTechWillClient.id,
          parentId: parent5.id,
          createdById: adminUser.id,
          assigneeId: adminUser.id,
          order: 1,
        }
      });
      await prisma.item.create({
        data: {
          type: ItemType.ACTION,
          name: '마지막 수정자 ID 조회 로직 보강',
          status: ItemStatus.COMPLETED,
          progress: 100,
          startDate: completedStart,
          endDate: completedEnd,
          clientId: dzTechWillClient.id,
          parentId: parent5.id,
          createdById: adminUser.id,
          assigneeId: adminUser.id,
          order: 2,
        }
      });
      console.log('    ✓ Created 2 sub-actions');
    }
  }

  // 백오피스(차세대 통합) - 관리자 - 개발팀
  await createAction('관리자', '개발팀', '백오피스 관리자 툴', ItemStatus.IN_PROGRESS, '백오피스 메뉴 및 역할 API 개발', 1);

  // 백오피스(차세대 통합) - 워크스페이스 - 개발팀
  await createAction('워크스페이스', '개발팀', '이택스코리아의 액션, 권한 API 응답 스펙 수정', ItemStatus.COMPLETED, '', 1);

  // 사내 전산 인프라 구축(차세대) - 인프라 현황 분석 - 인프라팀
  await createAction('인프라 현황 분석', '인프라팀', '서버 자산 파악', ItemStatus.COMPLETED, 'IDC 서버, 사내 전산실 서버, 클라우드 서버', 1);
  await createAction('인프라 현황 분석', '인프라팀', '서버 구성 분석', ItemStatus.ON_HOLD, 'OS, WEB, APP, DBS, 그 외, 3rd party 솔루션 등', 2);
  await createAction('인프라 현황 분석', '인프라팀', '네트워크 자산 파악', ItemStatus.ON_HOLD, 'AP, L2 SW, Modem, VPN 등', 3);

  // 사내 전산 인프라 구축(차세대) - 차세대 인프라 구축 - 인프라팀
  const team4 = await findTeam('차세대 인프라 구축', '인프라팀');
  if (team4) {
    const parent6 = await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: 'UPS 도입 제안',
        description: '전력 유지 시스템 - 약 1시간',
        status: ItemStatus.IN_PROGRESS,
        progress: 50,
        startDate: inProgressStart,
        endDate: inProgressEnd,
        clientId: dzTechWillClient.id,
        parentId: team4.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    console.log('  ✓ Created action: UPS 도입 제안');

    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '업체 미팅 진행 완료',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent6.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '견적서 회신 대기',
        status: ItemStatus.IN_PROGRESS,
        progress: 30,
        startDate: inProgressStart,
        endDate: inProgressEnd,
        clientId: dzTechWillClient.id,
        parentId: parent6.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 2,
      }
    });
    console.log('    ✓ Created 2 sub-actions');

    const parent7 = await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '통합 NW 장비 도입 제안',
        description: '방화벽, L3, L2 등 특정 기능 통합적으로 한 Device에서 제공',
        status: ItemStatus.IN_PROGRESS,
        progress: 50,
        startDate: inProgressStart,
        endDate: inProgressEnd,
        clientId: dzTechWillClient.id,
        parentId: team4.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 2,
      }
    });
    console.log('  ✓ Created action: 통합 NW 장비 도입 제안');

    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '업체 미팅 진행 완료',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent7.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '견적서 회신 대기',
        status: ItemStatus.IN_PROGRESS,
        progress: 30,
        startDate: inProgressStart,
        endDate: inProgressEnd,
        clientId: dzTechWillClient.id,
        parentId: parent7.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 2,
      }
    });
    console.log('    ✓ Created 2 sub-actions');
  }

  // 사내 전산 인프라 구축(차세대) - 인프라 관리 솔루션 테스트 - 인프라팀
  const team5 = await findTeam('인프라 관리 솔루션 테스트', '인프라팀');
  if (team5) {
    const parent8 = await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '자산관리 시스템 (DZ helpdesk)',
        status: ItemStatus.IN_PROGRESS,
        progress: 70,
        startDate: inProgressStart,
        endDate: inProgressEnd,
        clientId: dzTechWillClient.id,
        parentId: team5.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    console.log('  ✓ Created action: 자산관리 시스템 (DZ helpdesk)');

    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '설치',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent8.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '테스트',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent8.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 2,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '서버, 네트워크 등 자산 리스트 업로드',
        status: ItemStatus.IN_PROGRESS,
        progress: 40,
        startDate: inProgressStart,
        endDate: inProgressEnd,
        clientId: dzTechWillClient.id,
        parentId: parent8.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 3,
      }
    });
    console.log('    ✓ Created 3 sub-actions');

    const parent9 = await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '모니터링 시스템 (DZ MON)',
        status: ItemStatus.IN_PROGRESS,
        progress: 60,
        startDate: inProgressStart,
        endDate: inProgressEnd,
        clientId: dzTechWillClient.id,
        parentId: team5.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 2,
      }
    });
    console.log('  ✓ Created action: 모니터링 시스템 (DZ MON)');

    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '설치',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent9.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '테스트',
        status: ItemStatus.IN_PROGRESS,
        progress: 50,
        startDate: inProgressStart,
        endDate: inProgressEnd,
        clientId: dzTechWillClient.id,
        parentId: parent9.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 2,
      }
    });
    console.log('    ✓ Created 2 sub-actions');

    const parent10 = await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '접속관리 시스템 (DZ SACS)',
        status: ItemStatus.IN_PROGRESS,
        progress: 60,
        startDate: inProgressStart,
        endDate: inProgressEnd,
        clientId: dzTechWillClient.id,
        parentId: team5.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 3,
      }
    });
    console.log('  ✓ Created action: 접속관리 시스템 (DZ SACS)');

    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '설치',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: parent10.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '테스트',
        status: ItemStatus.IN_PROGRESS,
        progress: 50,
        startDate: inProgressStart,
        endDate: inProgressEnd,
        clientId: dzTechWillClient.id,
        parentId: parent10.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 2,
      }
    });
    console.log('    ✓ Created 2 sub-actions');
  }

  // 사내 전산 인프라 구축(차세대) - 인프라 구성 표준 및 정책 문서화 - 인프라팀
  const team6 = await findTeam('인프라 구성 표준 및 정책 문서화', '인프라팀');
  if (team6) {
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: 'OS 설치 및 설정 표준안 초안',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: team6.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: 'Docker 설치 및 설정 표준안 초안',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: team6.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 2,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: 'Web 설치 및 설정 표준안 초안',
        status: ItemStatus.NOT_STARTED,
        progress: 0,
        clientId: dzTechWillClient.id,
        parentId: team6.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 3,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: 'APP 설치 및 설정 표준안 초안',
        status: ItemStatus.NOT_STARTED,
        progress: 0,
        clientId: dzTechWillClient.id,
        parentId: team6.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 4,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: 'DBS 설치 및 설정 표준안 초안',
        status: ItemStatus.NOT_STARTED,
        progress: 0,
        clientId: dzTechWillClient.id,
        parentId: team6.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 5,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: 'hostname 작명 규칙 표준안 초안',
        status: ItemStatus.COMPLETED,
        progress: 100,
        startDate: completedStart,
        endDate: completedEnd,
        clientId: dzTechWillClient.id,
        parentId: team6.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 6,
      }
    });
    console.log('  ✓ Created 6 actions');

    const parent11 = await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '더존테크윌 전체 인프라 구성도',
        status: ItemStatus.NOT_STARTED,
        progress: 0,
        clientId: dzTechWillClient.id,
        parentId: team6.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 7,
      }
    });
    console.log('  ✓ Created action: 더존테크윌 전체 인프라 구성도');

    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '이택스코리아 인프라 구성도',
        status: ItemStatus.NOT_STARTED,
        progress: 0,
        clientId: dzTechWillClient.id,
        parentId: parent11.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 1,
      }
    });
    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '양도코리아 인프라 구성도',
        status: ItemStatus.NOT_STARTED,
        progress: 0,
        clientId: dzTechWillClient.id,
        parentId: parent11.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 2,
      }
    });
    console.log('    ✓ Created 2 sub-actions');

    await prisma.item.create({
      data: {
        type: ItemType.ACTION,
        name: '더존테크윌 네트워크 구성도',
        status: ItemStatus.NOT_STARTED,
        progress: 0,
        clientId: dzTechWillClient.id,
        parentId: team6.id,
        createdById: adminUser.id,
        assigneeId: adminUser.id,
        order: 8,
      }
    });
    console.log('  ✓ Created action: 더존테크윌 네트워크 구성도');
  }

  // 사내 전산 인프라 구축(차세대) - 인프라 보안 정책 및 표준 문서화 - 인프라팀
  await createAction('인프라 보안 정책 및 표준 문서화', '인프라팀', '인프라 자산 접속을 위한 계정 비밀번호 생성 규칙 표준안 초안', ItemStatus.COMPLETED, '', 1);
  await createAction('인프라 보안 정책 및 표준 문서화', '인프라팀', 'OS 보안 설정 표준 가이드 및 체크리스트', ItemStatus.IN_PROGRESS, '', 2);

  // 프로젝트 관리(차세대) - 신규 PMS 솔루션 도입 제안 - 기획팀
  await createAction('신규 PMS 솔루션 도입 제안', '기획팀', 'PMS 솔루션 시장 조사 및 기능 분석', ItemStatus.IN_PROGRESS, '', 1);

  // 프로젝트 관리(차세대) - 프로젝트 관리를 위한 프레임워크 개발 - 기획팀
  await createAction('프로젝트 관리를 위한 프레임워크 개발', '기획팀', '문서화', ItemStatus.IN_PROGRESS, '', 1);
  await createAction('프로젝트 관리를 위한 프레임워크 개발', '기획팀', '팀 내 교육', ItemStatus.NOT_STARTED, '', 2);

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
