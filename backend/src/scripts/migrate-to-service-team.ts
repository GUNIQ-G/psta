/**
 * Migration Script: Migrate from Item(type=TEAM) to ServiceTeam table
 *
 * This script:
 * 1. Creates ServiceTeam records from existing Item(type=TEAM)
 * 2. Updates ACTION items to reference ServiceTeam instead of TEAM
 * 3. Keeps Item(type=TEAM) for now (will be removed later)
 *
 * Run: npx ts-node src/scripts/migrate-to-service-team.ts
 */

import prisma from '../config/database';
import { ItemType } from '@prisma/client';
import { randomUUID } from 'crypto';

interface MigrationStats {
  teamItemsFound: number;
  serviceTeamsCreated: number;
  actionsUpdated: number;
  errors: string[];
}

async function migrateToServiceTeam() {
  const stats: MigrationStats = {
    teamItemsFound: 0,
    serviceTeamsCreated: 0,
    actionsUpdated: 0,
    errors: [],
  };

  try {
    console.log('🔍 Step 1: Finding all Item(type=TEAM)...');

    // Get all TEAM items
    const teamItems = await prisma.item.findMany({
      where: {
        type: ItemType.TEAM,
        isDeleted: false,
      },
      include: {
        other_Item: {
          where: {
            type: ItemType.ACTION,
            isDeleted: false,
          },
        },
      },
    });

    stats.teamItemsFound = teamItems.length;
    console.log(`   Found ${teamItems.length} TEAM items`);

    console.log('\n📊 Step 2: Creating ServiceTeam records and updating ACTIONs...');

    for (const teamItem of teamItems) {
      try {
        // Find matching organization Team by name
        const orgTeam = await prisma.team.findFirst({
          where: { name: teamItem.name },
        });

        if (!orgTeam) {
          const error = `⚠️  Team "${teamItem.name}" not found in organization Team table`;
          console.log(`   ${error}`);
          stats.errors.push(error);
          continue;
        }

        if (!teamItem.parentId) {
          const error = `⚠️  Team "${teamItem.name}" (${teamItem.id}) has no parentId (service)`;
          console.log(`   ${error}`);
          stats.errors.push(error);
          continue;
        }

        // Check if ServiceTeam already exists
        const existingServiceTeam = await prisma.$queryRaw<any[]>`
          SELECT * FROM "ServiceTeam"
          WHERE "serviceId" = ${teamItem.parentId}
          AND "teamId" = ${orgTeam.id}
          LIMIT 1
        `;

        let serviceTeamId: string;

        if (existingServiceTeam.length > 0) {
          serviceTeamId = existingServiceTeam[0].id;
          console.log(`   ⏭️  ServiceTeam already exists for ${teamItem.name} in service ${teamItem.parentId.substring(0, 8)}...`);
        } else {
          // Create ServiceTeam record
          serviceTeamId = randomUUID();

          await prisma.$executeRaw`
            INSERT INTO "ServiceTeam" (id, "serviceId", "teamId", "createdAt", "updatedAt")
            VALUES (${serviceTeamId}, ${teamItem.parentId}, ${orgTeam.id}, NOW(), NOW())
          `;

          stats.serviceTeamsCreated++;
          console.log(`   ✅ Created ServiceTeam for "${teamItem.name}" in service ${teamItem.parentId.substring(0, 8)}...`);
        }

        // Update all ACTIONs under this TEAM to reference the ServiceTeam
        if (teamItem.other_Item.length > 0) {
          await prisma.item.updateMany({
            where: {
              id: { in: teamItem.other_Item.map(a => a.id) },
              type: ItemType.ACTION,
            },
            data: {
              serviceTeamId: serviceTeamId,
            },
          });

          stats.actionsUpdated += teamItem.other_Item.length;
          console.log(`      → Updated ${teamItem.other_Item.length} ACTIONs to reference ServiceTeam`);
        }

      } catch (error: any) {
        const errorMsg = `❌ Error processing team "${teamItem.name}": ${error.message}`;
        console.error(`   ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   TEAM items found:      ${stats.teamItemsFound}`);
    console.log(`   ServiceTeams created:  ${stats.serviceTeamsCreated}`);
    console.log(`   ACTIONs updated:       ${stats.actionsUpdated}`);
    console.log(`   Errors:                ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log('\n✨ Migration completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Verify data with validation script');
    console.log('   2. Update backend APIs to use ServiceTeam');
    console.log('   3. Update frontend to use ServiceTeam');
    console.log('   4. After testing, remove Item(type=TEAM) records');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateToServiceTeam()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
