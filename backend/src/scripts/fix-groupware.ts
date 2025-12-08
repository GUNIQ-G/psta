const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  // 이동할 액션들
  const actionNames = [
    "사내 그룹웨어 신규개발(전체적인 오류 수정 및 고도화)",
    "사내 그룹웨어 신규개발(권한  시스템 구축)"
  ];

  // AI 바이브 코딩 도입 서비스 찾기
  const targetService = await prisma.item.findFirst({
    where: {
      name: { contains: "AI 바이브 코딩" },
      type: "SERVICE",
      isDeleted: false
    }
  });

  if (!targetService) {
    console.log("Target service not found");
    return;
  }

  console.log("Target Service:", targetService.name);

  // 개발팀 TEAM Item 찾기
  let teamItem = await prisma.item.findFirst({
    where: {
      parentId: targetService.id,
      type: "TEAM",
      name: { contains: "개발팀" },
      isDeleted: false
    }
  });

  if (!teamItem) {
    teamItem = await prisma.item.create({
      data: {
        id: randomUUID(),
        type: "TEAM",
        name: "개발팀",
        status: "NOT_STARTED",
        progress: 0,
        clientId: targetService.clientId,
        parentId: targetService.id,
        createdById: admin!.id,
        updatedAt: new Date()
      }
    });
    console.log("Created TEAM: 개발팀");
  }

  // ServiceTeam 찾기
  const team = await prisma.team.findFirst({ where: { name: { contains: "개발팀" } } });
  const serviceTeam = team ? await prisma.serviceTeam.findFirst({
    where: { serviceId: targetService.id, teamId: team.id }
  }) : null;

  // 각 액션 이동
  for (const name of actionNames) {
    const action = await prisma.item.findFirst({
      where: {
        name: { contains: name.slice(0, 20) },
        type: "ACTION",
        isDeleted: false
      }
    });

    if (!action) {
      console.log("Not found:", name.slice(0, 30));
      continue;
    }

    await prisma.item.update({
      where: { id: action.id },
      data: {
        parentId: teamItem.id,
        serviceTeamId: serviceTeam?.id || action.serviceTeamId
      }
    });

    console.log("Moved:", action.name.slice(0, 40));
  }

  console.log("\nDone!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
