import { PrismaClient, ItemType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.item.findMany({
    where: { type: ItemType.PROJECT },
    include: {
      other_Item: {
        where: { type: ItemType.SERVICE }
      }
    }
  });

  console.log('\n=== 현재 프로젝트 및 서비스 목록 ===\n');
  
  for (const project of projects) {
    console.log(`프로젝트: ${project.name}`);
    if (project.other_Item.length > 0) {
      for (const service of project.other_Item) {
        console.log(`  └─ 서비스: ${service.name}`);
      }
    } else {
      console.log('  └─ (서비스 없음)');
    }
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
