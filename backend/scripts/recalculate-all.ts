import { PrismaClient, ItemType } from '@prisma/client';
import { updateItemAndParents } from '../src/services/item-calculation.service';

const prisma = new PrismaClient();

async function recalculateAll() {
  console.log('Starting recalculation of all items...');

  // Get all TEAM items (bottom-up approach)
  const teams = await prisma.item.findMany({
    where: { type: ItemType.TEAM },
    select: { id: true, name: true },
  });

  console.log(`Found ${teams.length} teams to recalculate`);

  for (const team of teams) {
    console.log(`Recalculating team: ${team.name}`);
    try {
      await updateItemAndParents(team.id);
    } catch (error) {
      console.error(`Error recalculating team ${team.name}:`, error);
    }
  }

  // Also recalculate all services (in case some don't have teams)
  const services = await prisma.item.findMany({
    where: { type: ItemType.SERVICE },
    select: { id: true, name: true },
  });

  console.log(`Found ${services.length} services to recalculate`);

  for (const service of services) {
    console.log(`Recalculating service: ${service.name}`);
    try {
      await updateItemAndParents(service.id);
    } catch (error) {
      console.error(`Error recalculating service ${service.name}:`, error);
    }
  }

  // Finally recalculate all projects
  const projects = await prisma.item.findMany({
    where: { type: ItemType.PROJECT },
    select: { id: true, name: true },
  });

  console.log(`Found ${projects.length} projects to recalculate`);

  for (const project of projects) {
    console.log(`Recalculating project: ${project.name}`);
    try {
      await updateItemAndParents(project.id);
    } catch (error) {
      console.error(`Error recalculating project ${project.name}:`, error);
    }
  }

  console.log('Recalculation complete!');
}

recalculateAll()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
