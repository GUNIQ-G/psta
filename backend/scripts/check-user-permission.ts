import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findFirst({
    where: { username: 'yg.kim' },
    include: {
      Team: true,
    },
  });

  if (!user) {
    console.log('yg.kim 사용자를 찾을 수 없습니다.');
    await prisma.$disconnect();
    return;
  }

  console.log('사용자 정보:');
  console.log('  ID:', user.id);
  console.log('  이름:', user.displayName);
  console.log('  역할:', user.role);
  console.log('  팀:', user.Team?.name || '없음');
  console.log('  인증:', user.isVerified);
  console.log('  활성:', user.isActive);

  // projects 리소스 권한 확인
  const permission = await prisma.permission.findUnique({
    where: {
      role_resource: {
        role: user.role,
        resource: 'projects',
      },
    },
  });

  console.log('\nprojects 권한:');
  if (permission) {
    console.log('  canView:', permission.canView);
    console.log('  canCreate:', permission.canCreate);
    console.log('  canUpdate:', permission.canUpdate);
    console.log('  canDelete:', permission.canDelete);
  } else {
    console.log('  권한 없음');
  }

  await prisma.$disconnect();
}

checkUser();
