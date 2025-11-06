import { PrismaClient, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// 리소스 정의
const resources = [
  'dashboard',
  'requests',
  'psta',
  'wbs',
  'report',
  'integrated-files',
  'clients',
  'projects',
  'services',
  'actions',
  'teams',
  'users',
  'user-approval',
  'general-settings',
  'ldap-auth',
  'notification-apps',
  'permissions',
];

// 역할별 기본 권한 설정
const defaultPermissions = {
  [UserRole.ADMIN]: {
    // Admin: 모든 페이지 접근, 모든 CRUD 허용
    dashboard: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    requests: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    psta: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    wbs: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    report: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    'integrated-files': { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    clients: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    projects: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    services: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    actions: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    teams: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    users: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    'user-approval': { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    'general-settings': { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    'ldap-auth': { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    'notification-apps': { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    permissions: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
  },
  [UserRole.PO]: {
    // PO: 조직 관리, 시스템 설정 숨김
    dashboard: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    requests: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    psta: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    wbs: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    report: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    'integrated-files': { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    clients: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    projects: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    services: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    actions: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    teams: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    users: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    'user-approval': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    'general-settings': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    'ldap-auth': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    'notification-apps': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    permissions: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
  },
  [UserRole.PM]: {
    // PM: 조직 관리, 시스템 설정 숨김, 클라이언트/프로젝트는 읽기만
    dashboard: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    requests: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    psta: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    wbs: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    report: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    'integrated-files': { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    clients: { canView: true, canCreate: false, canUpdate: false, canDelete: false },
    projects: { canView: true, canCreate: false, canUpdate: false, canDelete: false },
    services: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    actions: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    teams: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    users: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    'user-approval': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    'general-settings': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    'ldap-auth': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    'notification-apps': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    permissions: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
  },
  [UserRole.MEMBER]: {
    // Member: 대시보드+작업요청(모든 권한), 프로젝트 일정(읽기만), 나머지 숨김
    dashboard: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    requests: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    psta: { canView: true, canCreate: false, canUpdate: false, canDelete: false },
    wbs: { canView: true, canCreate: false, canUpdate: false, canDelete: false },
    report: { canView: true, canCreate: false, canUpdate: false, canDelete: false },
    'integrated-files': { canView: true, canCreate: false, canUpdate: false, canDelete: false },
    clients: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    projects: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    services: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    actions: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    teams: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    users: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    'user-approval': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    'general-settings': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    'ldap-auth': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    'notification-apps': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    permissions: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
  },
};

async function seedPermissions() {
  console.log('🔐 권한 데이터 시드 시작...\n');

  try {
    // 기존 권한 삭제
    await prisma.permission.deleteMany({});
    console.log('✓ 기존 권한 데이터 삭제 완료');

    // 각 역할별로 권한 생성
    for (const role of Object.values(UserRole)) {
      const rolePermissions = defaultPermissions[role];

      for (const resource of resources) {
        const permission = (rolePermissions as any)[resource];

        if (permission) {
          await prisma.permission.create({
            data: {
              id: randomUUID(),
              role,
              resource,
              ...permission,
              updatedAt: new Date(),
            },
          });
        }
      }

      console.log(`✓ ${role} 역할 권한 생성 완료`);
    }

    console.log('\n✅ 권한 데이터 시드 완료!');
    console.log(`\n총 ${resources.length * Object.values(UserRole).length}개 권한 생성됨\n`);

    // 권한 요약 출력
    console.log('📊 역할별 접근 가능한 리소스:');
    for (const role of Object.values(UserRole)) {
      const permissions = await prisma.permission.findMany({
        where: { role, canView: true },
      });
      console.log(`\n${role}:`);
      permissions.forEach(p => {
        const actions = [];
        if (p.canCreate) actions.push('C');
        if (p.canUpdate) actions.push('U');
        if (p.canDelete) actions.push('D');
        const crud = actions.length > 0 ? `[${actions.join('')}]` : '[R]';
        console.log(`  - ${p.resource} ${crud}`);
      });
    }

  } catch (error) {
    console.error('❌ 권한 시드 실패:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function seedBasicData() {
  console.log('\n👤 기본 사용자 및 클라이언트 데이터 시드 시작...\n');

  try {
    // Admin 사용자 생성
    const admin = await prisma.user.create({
      data: {
        id: randomUUID(),
        username: 'admin',
        email: 'admin@psta.com',
        displayName: '관리자',
        role: UserRole.ADMIN,
        isVerified: true,
        isActive: true,
        updatedAt: new Date(),
      },
    });
    console.log('✓ Admin 사용자 생성:', admin.username);

    // yg.kim 사용자 생성 (PO)
    const ygkim = await prisma.user.create({
      data: {
        id: randomUUID(),
        username: 'yg.kim',
        email: 'yg.kim@psta.com',
        displayName: '김여겸',
        role: UserRole.PO,
        isVerified: true,
        isActive: true,
        updatedAt: new Date(),
      },
    });
    console.log('✓ PO 사용자 생성:', ygkim.username);

    // 더존테크윌 클라이언트 생성
    const client = await prisma.client.create({
      data: {
        id: randomUUID(),
        name: '더존테크윌',
        code: 'DZ_TECHWILL',
        phone: '02-1234-5678',
        email: 'contact@douzone.com',
        businessNumber: '123-45-67890',
        representative: '홍길동',
        address: '서울시 강남구 테헤란로 123',
        description: 'ERP 솔루션 전문 기업',
        isActive: true,
        updatedAt: new Date(),
      },
    });
    console.log('✓ 클라이언트 생성:', client.name);

    console.log('\n✅ 기본 데이터 시드 완료!\n');

  } catch (error) {
    console.error('❌ 기본 데이터 시드 실패:', error);
    throw error;
  }
}

async function main() {
  await seedBasicData();
  await seedPermissions();
}

main();
