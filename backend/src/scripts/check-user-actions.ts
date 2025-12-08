const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 박소영 사용자 찾기
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { displayName: { contains: "소영" } },
        { displayName: { contains: "박소영" } }
      ]
    },
    include: { Team: true }
  });

  console.log("=== Found Users ===\n");

  for (const user of users) {
    console.log("User:", user.displayName);
    console.log("  Username:", user.username);
    console.log("  Team:", user.Team?.name || "NULL");
    console.log("  TeamId:", user.teamId || "NULL");
    console.log("  IsActive:", user.isActive);
    console.log("");

    // 이 사용자가 담당자인 액션들
    const actions = await prisma.item.findMany({
      where: {
        assigneeId: user.id,
        type: "ACTION",
        isDeleted: false
      },
      select: {
        id: true,
        name: true,
        status: true,
        parentId: true
      }
    });

    console.log("  Assigned Actions:", actions.length);

    for (const action of actions) {
      // 계층 확인
      const team = action.parentId ? await prisma.item.findUnique({
        where: { id: action.parentId },
        select: { name: true, parentId: true }
      }) : null;

      const service = team?.parentId ? await prisma.item.findUnique({
        where: { id: team.parentId },
        select: { name: true }
      }) : null;

      console.log("    - " + action.name.slice(0, 40));
      console.log("      Status:", action.status);
      console.log("      Path:", (service?.name || "?") + " > " + (team?.name || "?"));
    }
    console.log("");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
