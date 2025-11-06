import { PrismaClient, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// 기본 권한 설정
const defaultPermissions = {
  [UserRole.ADMIN]: {
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
    'slack-notification': { canView: true, canCreate: true, canUpdate: true, canDelete: true },
    permissions: { canView: true, canCreate: true, canUpdate: true, canDelete: true },
  },
  [UserRole.PO]: {
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
    'slack-notification': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    permissions: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
  },
  [UserRole.PM]: {
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
    'slack-notification': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    permissions: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
  },
  [UserRole.MEMBER]: {
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
    'slack-notification': { canView: false, canCreate: false, canUpdate: false, canDelete: false },
    permissions: { canView: false, canCreate: false, canUpdate: false, canDelete: false },
  },
};

async function seedPermissions() {
  console.log('🔑 권한 데이터 시드 시작...');

  // 기존 권한 데이터 삭제
  await prisma.permission.deleteMany({});
  console.log('✅ 기존 권한 데이터 삭제 완료');

  let count = 0;

  // 모든 역할에 대해 권한 생성
  for (const [role, resources] of Object.entries(defaultPermissions)) {
    for (const [resource, permissions] of Object.entries(resources)) {
      await prisma.permission.create({
        data: {
          id: randomUUID(),
          role: role as UserRole,
          resource: resource,
          canView: permissions.canView,
          canCreate: permissions.canCreate,
          canUpdate: permissions.canUpdate,
          canDelete: permissions.canDelete,
          updatedAt: new Date(),
        },
      });
      count++;
    }
  }

  console.log(`✅ ${count}개의 권한 데이터 생성 완료`);
}

async function main() {
  try {
    await seedPermissions();
    console.log('\n✅ 권한 시드 완료');
  } catch (error) {
    console.error('❌ 권한 시드 실패:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
