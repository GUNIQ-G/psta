const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("=== 전체 계층 구조 분석 ===\n");

  // 모든 활성 Item 조회
  const items = await prisma.item.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      type: true,
      parentId: true,
      serviceTeamId: true,
      clientId: true,
    },
  });

  const itemMap = new Map(items.map((i: any) => [i.id, i]));

  // 타입별 통계
  const stats = { PROJECT: 0, SERVICE: 0, TEAM: 0, ACTION: 0 };
  items.forEach((i: any) => {
    if (stats[i.type as keyof typeof stats] !== undefined) {
      stats[i.type as keyof typeof stats]++;
    }
  });

  console.log("타입별 개수:");
  console.log("  PROJECT:", stats.PROJECT);
  console.log("  SERVICE:", stats.SERVICE);
  console.log("  TEAM:", stats.TEAM);
  console.log("  ACTION:", stats.ACTION);
  console.log("");

  // 계층 구조 문제 검사
  const issues: any[] = [];

  for (const item of items) {
    if (!item.parentId) {
      // 루트 레벨은 PROJECT만 허용
      if (item.type !== "PROJECT") {
        issues.push({
          type: "NO_PARENT",
          item: item,
          message: item.type + "가 parentId 없음 (PROJECT만 루트 가능)",
        });
      }
      continue;
    }

    const parent = itemMap.get(item.parentId);
    if (!parent) {
      issues.push({
        type: "ORPHAN",
        item: item,
        message: "parentId가 존재하지 않는 항목 참조",
      });
      continue;
    }

    // 계층 규칙 검사: SERVICE->PROJECT, TEAM->SERVICE, ACTION->TEAM
    const validParents: Record<string, string[]> = {
      SERVICE: ["PROJECT"],
      TEAM: ["SERVICE"],
      ACTION: ["TEAM"],
    };

    const itemType = item.type as string;
    const parentType = (parent as any).type as string;

    if (itemType !== "PROJECT") {
      const expected = validParents[itemType];
      if (expected && !expected.includes(parentType)) {
        issues.push({
          type: "WRONG_PARENT_TYPE",
          item: item,
          parent: parent,
          message: itemType + "의 부모가 " + parentType + " (예상: " + expected.join("/") + ")",
        });
      }
    }
  }

  // ServiceTeam 불일치 검사
  const actionsWithST = items.filter((i: any) => i.type === "ACTION" && i.serviceTeamId);

  for (const action of actionsWithST) {
    const serviceTeam = await prisma.serviceTeam.findUnique({
      where: { id: action.serviceTeamId },
      select: { serviceId: true, teamId: true, Team: { select: { name: true } } },
    });

    if (!serviceTeam) continue;

    // action -> TEAM -> SERVICE 경로 확인
    const teamItem = itemMap.get(action.parentId) as any;
    if (!teamItem) continue;

    const serviceItem = itemMap.get(teamItem.parentId) as any;
    if (!serviceItem) continue;

    if (serviceItem.id !== serviceTeam.serviceId) {
      issues.push({
        type: "SERVICETEAM_MISMATCH",
        item: action,
        expectedServiceId: serviceTeam.serviceId,
        actualServiceId: serviceItem.id,
        message: "액션의 Item 계층이 ServiceTeam 서비스와 불일치",
      });
    }
  }

  console.log("=== 발견된 문제 ===\n");

  if (issues.length === 0) {
    console.log("✅ 문제 없음!");
  } else {
    // 문제 유형별 그룹화
    const byType: Record<string, any[]> = {};
    issues.forEach((i) => {
      if (!byType[i.type]) byType[i.type] = [];
      byType[i.type].push(i);
    });

    for (const [type, list] of Object.entries(byType)) {
      console.log("[" + type + "] " + list.length + "건");
      (list as any[]).slice(0, 10).forEach((i: any) => {
        console.log("  - " + i.item.type + ": " + i.item.name.slice(0, 40));
        console.log("    " + i.message);
        if (i.parent) {
          console.log("    부모: " + i.parent.type + ": " + i.parent.name.slice(0, 35));
        }
      });
      if (list.length > 10) {
        console.log("  ... 외 " + (list.length - 10) + "건");
      }
      console.log("");
    }
  }

  console.log("총 문제:", issues.length, "건");
}

main().catch(console.error).finally(() => prisma.$disconnect());
