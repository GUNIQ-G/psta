const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");
const prisma = new PrismaClient();

async function main() {
  // 수정 대상 목록 (ID와 타겟 서비스)
  const fixes = [
    { id: "8fdd7c25-54c", targetService: "기타) 인명록, 게시판, 자료실 및 기능" },
    { id: "1cbc901e-a60", targetService: "실무편람) 사무소" },
    { id: "06cd8fd6-322", targetService: "인명록" },
    { id: "9ce2b2ca-ee8", targetService: "회계) K-IFRS" },
    { id: "ee0a321e-9b6", targetService: "국제조약" },
    { id: "f5f0a276-06e", targetService: "회계) K-IFRS" },
    { id: "55a07cdd-efe", targetService: "회계) 기준서" },
    { id: "1a91c82e-dbf", targetService: "회계) 기준서" },
    { id: "ad34ceee-41d", targetService: "회계) 기준서" },
    { id: "7c2623e1-1da", targetService: "실무편람) 사무소" },
    { id: "06a271e9-fab", targetService: "실무편람) 정보조회" },
    { id: "9f71e3ff-03d", targetService: "실무편람) 정보조회" },
    { id: "4fd88bce-f81", targetService: "실무편람) 세무신고" },
    { id: "bead64d9-8af", targetService: "실무편람) 세무신고" },
    { id: "46c024f4-df6", targetService: "데일리이택스" },
    { id: "497dffdf-33a", targetService: "데일리이택스" },
    { id: "0f32954f-1cd", targetService: "인명록" },
    { id: "d4f44d7c-367", targetService: "기타) 인명록, 게시판, 자료실 및 기능" },
  ];

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  let successCount = 0;
  let errorCount = 0;

  console.log("=== 액션 서비스 재배치 시작 ===\n");

  for (const fix of fixes) {
    try {
      // 액션 찾기 (ID 앞부분으로)
      const action = await prisma.item.findFirst({
        where: {
          id: { startsWith: fix.id },
          type: "ACTION",
          isDeleted: false
        },
        select: { id: true, name: true, parentId: true, serviceTeamId: true }
      });

      if (!action) {
        console.log("X 액션 없음: " + fix.id);
        errorCount++;
        continue;
      }

      // 현재 팀 정보
      const currentTeam = await prisma.item.findUnique({
        where: { id: action.parentId },
        select: { name: true }
      });
      const teamName = currentTeam?.name || "기획디자인팀";

      // 타겟 서비스 찾기
      const targetService = await prisma.item.findFirst({
        where: {
          name: { contains: fix.targetService.split(")").pop()?.trim() || fix.targetService },
          type: "SERVICE",
          isDeleted: false
        }
      });

      if (!targetService) {
        console.log("X 서비스 없음: " + fix.targetService);
        errorCount++;
        continue;
      }

      // 타겟 서비스에 해당 팀의 TEAM Item 찾기
      let targetTeamItem = await prisma.item.findFirst({
        where: {
          parentId: targetService.id,
          type: "TEAM",
          name: teamName,
          isDeleted: false
        }
      });

      // 없으면 생성
      if (!targetTeamItem) {
        const newId = randomUUID();
        targetTeamItem = await prisma.item.create({
          data: {
            id: newId,
            type: "TEAM",
            name: teamName,
            status: "NOT_STARTED",
            progress: 0,
            clientId: targetService.clientId,
            parentId: targetService.id,
            createdById: admin!.id,
            updatedAt: new Date()
          }
        });
        console.log("  + TEAM 생성: " + teamName + " @ " + targetService.name);
      }

      // 타겟 서비스의 ServiceTeam 찾기
      const team = await prisma.team.findFirst({
        where: { name: teamName }
      });

      let targetServiceTeam = null;
      if (team) {
        targetServiceTeam = await prisma.serviceTeam.findFirst({
          where: {
            serviceId: targetService.id,
            teamId: team.id
          }
        });
      }

      // 액션 업데이트
      await prisma.item.update({
        where: { id: action.id },
        data: {
          parentId: targetTeamItem.id,
          serviceTeamId: targetServiceTeam?.id || action.serviceTeamId
        }
      });

      console.log("O " + action.name.slice(0, 35));
      console.log("  -> " + targetService.name + " > " + teamName);
      successCount++;

    } catch (err: any) {
      console.log("X 오류: " + err.message);
      errorCount++;
    }
  }

  console.log("\n=== 완료 ===");
  console.log("성공: " + successCount + "건");
  console.log("실패: " + errorCount + "건");
}

main().catch(console.error).finally(() => prisma.$disconnect());
