import { LdapSyncService } from '../services/ldap-sync.service';
import prisma from '../config/database';
import { ldapLogger } from '../config/logger';

async function runFullSync() {
  try {
    ldapLogger.info('='.repeat(60));
    ldapLogger.info('🔄 Starting full LDAP synchronization...');
    ldapLogger.info('='.repeat(60));

    const ldapSyncService = new LdapSyncService();
    const result = await ldapSyncService.syncFromLdap(false);

    ldapLogger.info('='.repeat(60));
    ldapLogger.info('✅ Full LDAP sync completed successfully!');
    ldapLogger.info('='.repeat(60));
    ldapLogger.info(`Teams created: ${result.teamsCreated}`);
    ldapLogger.info(`Teams deactivated: ${result.teamsDeactivated}`);
    ldapLogger.info(`Users deactivated: ${result.usersDeactivated}`);
    ldapLogger.info(`Team memberships updated: ${result.teamMembershipsUpdated}`);
    ldapLogger.info(`Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      ldapLogger.error('Sync errors:');
      result.errors.forEach((err: string) => ldapLogger.error(`  - ${err}`));
    }

    // Show team hierarchy
    ldapLogger.info('\n' + '='.repeat(60));
    ldapLogger.info('📂 Team hierarchy:');
    ldapLogger.info('='.repeat(60));
    const teams = await prisma.team.findMany({
      where: { isActive: true },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    for (const team of teams) {
      const indent = '  '.repeat(team.level - 1);
      ldapLogger.info(`${indent}├─ L${team.level}: ${team.name} (${team.ldapType || 'Group'})`);
    }

    // Check user "후영"
    ldapLogger.info('\n' + '='.repeat(60));
    ldapLogger.info('🎯 Checking user "후영":');
    ldapLogger.info('='.repeat(60));
    const huyoungUser = await prisma.user.findFirst({
      where: { username: '후영' },
      include: {
        Team: { select: { name: true, level: true, parentId: true } },
        Organization: { select: { name: true } },
      },
    });

    if (huyoungUser) {
      ldapLogger.info(`Username: ${huyoungUser.username}`);
      ldapLogger.info(`DisplayName: ${huyoungUser.displayName}`);
      ldapLogger.info(`LDAP DN: ${huyoungUser.ldapDn}`);
      ldapLogger.info(`TeamId: ${huyoungUser.teamId}`);
      if (huyoungUser.Team) {
        ldapLogger.info(`Team: ${huyoungUser.Team.name} (Level ${huyoungUser.Team.level})`);
      } else {
        ldapLogger.warn('❌ User is not assigned to any team!');
      }
      ldapLogger.info(`OrganizationId: ${huyoungUser.organizationId}`);
      if (huyoungUser.Organization) {
        ldapLogger.info(`Organization: ${huyoungUser.Organization.name}`);
      }
    } else {
      ldapLogger.error('❌ User "후영" not found!');
    }

    ldapLogger.info('='.repeat(60));
    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    ldapLogger.error('❌ Full sync failed:', error.message);
    ldapLogger.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

runFullSync();
