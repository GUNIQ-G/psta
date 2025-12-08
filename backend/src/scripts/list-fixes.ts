const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 주요 패턴 기반 의심 목록 생성 (순서 중요: 더 구체적인 패턴 먼저)
  const patterns = [
    // 실무편람 - 구체적인 것 먼저
    { keyword: "실무편람 정보조회", targetService: "실무편람) 정보조회" },
    { keyword: "실무편람(정보조회)", targetService: "실무편람) 정보조회" },
    { keyword: "실무편람 세무신고", targetService: "실무편람) 세무신고" },
    { keyword: "실무편람(세무신고)", targetService: "실무편람) 세무신고" },
    { keyword: "실무편람 사무소", targetService: "실무편람) 사무소" },
    { keyword: "실무편람(사무소)", targetService: "실무편람) 사무소" },
    // 회계 - 구체적인 것 먼저
    { keyword: "회계 K-IFRS", targetService: "회계) K-IFRS" },
    { keyword: "K-IFRS", targetService: "회계) K-IFRS" },
    { keyword: "회계 기준서", targetService: "회계) 기준서" },
    { keyword: "회계 기준", targetService: "회계) 기준서" },
    // 기타
    { keyword: "데일리이택스", targetService: "데일리이택스" },
    { keyword: "국제조약", targetService: "국제조약" },
    { keyword: "개정세법", targetService: "개정세법" },
    { keyword: "기타 페이지", targetService: "기타) 인명록, 게시판, 자료실 및 기능" },
    { keyword: "기타페이지", targetService: "기타) 인명록, 게시판, 자료실 및 기능" },
    { keyword: "인명록", targetService: "인명록" },
  ];

  const actions = await prisma.item.findMany({
    where: { type: "ACTION", isDeleted: false },
    select: { id: true, name: true, parentId: true, serviceTeamId: true }
  });

  const results: any[] = [];

  for (const action of actions) {
    // 현재 서비스 확인
    const teamItem = await prisma.item.findUnique({
      where: { id: action.parentId },
      select: { parentId: true, name: true }
    });
    if (!teamItem) continue;

    const currentService = await prisma.item.findUnique({
      where: { id: teamItem.parentId },
      select: { id: true, name: true }
    });
    if (!currentService) continue;

    // 패턴 매칭
    for (const p of patterns) {
      if (action.name.includes(p.keyword)) {
        // 타겟 서비스 찾기 - 정확한 매칭 시도
        let targetService = await prisma.item.findFirst({
          where: {
            name: p.targetService,
            type: "SERVICE",
            isDeleted: false
          }
        });

        // 정확 매칭 실패시 부분 매칭
        if (!targetService) {
          targetService = await prisma.item.findFirst({
            where: {
              name: { contains: p.targetService.split(")").pop()?.trim() || p.targetService },
              type: "SERVICE",
              isDeleted: false
            }
          });
        }

        if (targetService && targetService.id !== currentService.id) {
          results.push({
            id: action.id,
            name: action.name,
            teamName: teamItem.name,
            current: currentService.name,
            currentId: currentService.id,
            target: targetService.name,
            targetId: targetService.id
          });
        }
        break;
      }
    }
  }

  console.log("=== 수정 대상 액션 목록 ===\n");

  results.forEach((r, i) => {
    console.log((i+1) + ". " + r.name);
    console.log("   팀: " + r.teamName);
    console.log("   현재: " + r.current);
    console.log("   변경: " + r.target);
    console.log("   ID: " + r.id.slice(0, 12));
    console.log("");
  });

  console.log("총 " + results.length + "건");
}

main().catch(console.error).finally(() => prisma.$disconnect());
