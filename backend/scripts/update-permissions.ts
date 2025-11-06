import { PrismaClient, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function updatePermissions() {
  console.log('🔐 ldap-admin 권한 추가 중...\n');

  try {
    const roles = [UserRole.ADMIN, UserRole.PO, UserRole.PM, UserRole.MEMBER];
    
    for (const role of roles) {
      // ldap-admin 권한 확인
      const existing = await prisma.permission.findFirst({
        where: {
          role,
          resource: 'ldap-admin',
        },
      });

      if (existing) {
        console.log(`✓ ${role} 역할의 ldap-admin 권한이 이미 존재합니다`);
        continue;
      }

      // ADMIN만 ldap-admin 접근 가능
      const canAccess = role === UserRole.ADMIN;

      await prisma.permission.create({
        data: {
          id: randomUUID(),
          role,
          resource: 'ldap-admin',
          canView: canAccess,
          canCreate: canAccess,
          canUpdate: canAccess,
          canDelete: canAccess,
          updatedAt: new Date(),
        },
      });

      console.log(`✓ ${role} 역할에 ldap-admin 권한 추가 완료 (canView: ${canAccess})`);
    }

    console.log('\n✅ ldap-admin 권한 추가 완료!\n');

  } catch (error) {
    console.error('❌ 권한 업데이트 실패:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updatePermissions();
