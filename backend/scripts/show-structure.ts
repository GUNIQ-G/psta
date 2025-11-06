import { PrismaClient, ItemType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('PSTA 업무 구조\n');

  // Get all projects
  const projects = await prisma.item.findMany({
    where: { type: ItemType.PROJECT },
    orderBy: { order: 'asc' },
    include: {
      children: {
        where: { type: ItemType.SERVICE },
        orderBy: { order: 'asc' },
        include: {
          children: {
            where: { type: ItemType.TEAM },
            orderBy: { order: 'asc' }
          }
        }
      }
    }
  });

  for (const project of projects) {
    console.log(`${project.name}`);

    for (const service of project.children) {
      console.log(`  - ${service.name}`);

      for (const team of service.children) {
        console.log(`    - ${team.name}`);
      }
    }

    console.log(''); // Empty line between projects
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
