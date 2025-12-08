/**
 * Migration Script: Add "미정 서비스" to all existing projects
 *
 * This script finds all PROJECT items and creates a "미정 서비스" under each
 * project if it doesn't already exist.
 *
 * Run: npx ts-node src/scripts/add-undecided-services.ts
 */

import prisma from '../config/database';
import { ItemType } from '@prisma/client';
import { randomUUID } from 'crypto';

async function addUndecidedServicesToProjects() {
  try {
    console.log('🔍 Finding all projects...');

    // Get all projects (excluding deleted ones)
    const projects = await prisma.item.findMany({
      where: {
        type: ItemType.PROJECT,
        isDeleted: false,
      },
      include: {
        other_Item: {
          where: {
            type: ItemType.SERVICE,
            isDeleted: false,
          },
        },
      },
    });

    console.log(`📊 Found ${projects.length} projects`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const project of projects) {
      // Check if "미정 서비스" already exists
      const hasUndecidedService = project.other_Item.some((service) =>
        service.name.includes('미정')
      );

      if (hasUndecidedService) {
        console.log(`⏭️  Skipping "${project.name}" - already has 미정 서비스`);
        skippedCount++;
        continue;
      }

      // Create "미정 서비스"
      const undecidedService = await prisma.item.create({
        data: {
          id: randomUUID(),
          name: '미정 서비스',
          type: ItemType.SERVICE,
          status: 'NOT_STARTED',
          progress: 0,
          parentId: project.id,
          description: '서비스가 미정인 항목들을 위한 임시 서비스',
          createdById: project.createdById, // Use same creator as project
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Created "미정 서비스" for project "${project.name}"`);
      createdCount++;
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Created: ${createdCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📊 Total: ${projects.length}`);
    console.log('\n✨ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
addUndecidedServicesToProjects()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
