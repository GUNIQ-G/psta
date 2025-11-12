import { PrismaClient } from '@prisma/client';
import { LdapService } from '../config/ldap';
import { appLogger, errorLogger, ldapLogger } from '../config/logger';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const ldapService = new LdapService();

export interface SyncResult {
  success: boolean;
  timestamp: Date;
  teamsCreated: number;
  teamsDeactivated: number;
  usersDeactivated: number;
  teamMembershipsUpdated: number;
  errors: string[];
  details: {
    teamsCreated: string[];
    teamsDeactivated: string[];
    usersDeactivated: string[];
  };
}

export class LdapSyncService {
  /**
   * Main sync function - syncs teams and users from LDAP to PSTA
   * @param dryRun - If true, only simulates changes without applying them
   */
  async syncFromLdap(dryRun: boolean = false): Promise<SyncResult> {
    const startTime = new Date();
    ldapLogger.info('Starting LDAP sync', { dryRun });

    const result: SyncResult = {
      success: false,
      timestamp: startTime,
      teamsCreated: 0,
      teamsDeactivated: 0,
      usersDeactivated: 0,
      teamMembershipsUpdated: 0,
      errors: [],
      details: {
        teamsCreated: [],
        teamsDeactivated: [],
        usersDeactivated: [],
      },
    };

    try {
      // Step 1: Sync Teams from LDAP Groups
      ldapLogger.info('Step 1: Syncing teams from LDAP groups');
      const teamSyncResult = await this.syncTeams(dryRun);
      result.teamsCreated = teamSyncResult.created;
      result.teamsDeactivated = teamSyncResult.deactivated;
      result.details.teamsCreated = teamSyncResult.createdNames;
      result.details.teamsDeactivated = teamSyncResult.deactivatedNames;

      // Step 2: Deactivate users not in LDAP
      ldapLogger.info('Step 2: Deactivating users not in LDAP');
      const userSyncResult = await this.syncUsers(dryRun);
      result.usersDeactivated = userSyncResult.deactivated;
      result.details.usersDeactivated = userSyncResult.deactivatedNames;

      // Step 3: Update team memberships (only for active users)
      ldapLogger.info('Step 3: Updating team memberships');
      const membershipResult = await this.syncTeamMemberships(dryRun);
      result.teamMembershipsUpdated = membershipResult.updated;

      result.success = true;
      ldapLogger.info('LDAP sync completed successfully', {
        teamsCreated: result.teamsCreated,
        teamsDeactivated: result.teamsDeactivated,
        usersDeactivated: result.usersDeactivated,
        teamMembershipsUpdated: result.teamMembershipsUpdated,
        dryRun,
      });
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
      errorLogger.error('LDAP sync failed', {
        error: error.message,
        stack: error.stack,
      });
    }

    // Save sync history
    if (!dryRun) {
      await this.saveSyncHistory(result);
    }

    return result;
  }

  /**
   * Sync teams from LDAP groups
   */
  private async syncTeams(dryRun: boolean): Promise<{
    created: number;
    deactivated: number;
    createdNames: string[];
    deactivatedNames: string[];
  }> {
    const result = {
      created: 0,
      deactivated: 0,
      createdNames: [] as string[],
      deactivatedNames: [] as string[],
    };

    try {
      // Get all LDAP groups
      const ldapGroups = await ldapService.getGroups();
      const ldapGroupNames = ldapGroups.map(g => g.name).filter(Boolean);

      ldapLogger.info(`Found ${ldapGroups.length} LDAP groups`);

      // Get all PSTA teams
      const pstaTeams = await prisma.team.findMany();
      const pstaTeamNames = pstaTeams.map(t => t.name);

      // Create missing teams in PSTA
      for (const ldapGroup of ldapGroups) {
        if (!ldapGroup.name) continue;

        const existingTeam = pstaTeams.find(t => t.name === ldapGroup.name);

        if (!existingTeam) {
          // Create new team
          ldapLogger.info(`Creating team: ${ldapGroup.name}`);

          if (!dryRun) {
            await prisma.team.create({
              data: {
                id: randomUUID(),
                name: ldapGroup.name,
                ldapDn: ldapGroup.dn,
                description: ldapGroup.description || `LDAP 그룹: ${ldapGroup.name}`,
                isActive: true,
                updatedAt: new Date(),
              },
            });
          }

          result.created++;
          result.createdNames.push(ldapGroup.name);
        } else if (!existingTeam.isActive) {
          // Reactivate deactivated team
          ldapLogger.info(`Reactivating team: ${ldapGroup.name}`);

          if (!dryRun) {
            await prisma.team.update({
              where: { id: existingTeam.id },
              data: {
                isActive: true,
                ldapDn: ldapGroup.dn,
                updatedAt: new Date(),
              },
            });
          }
        }
      }

      // Deactivate teams not in LDAP (except admin-created teams without ldapDn)
      for (const pstaTeam of pstaTeams) {
        if (!ldapGroupNames.includes(pstaTeam.name) && pstaTeam.isActive && pstaTeam.ldapDn) {
          ldapLogger.info(`Deactivating team: ${pstaTeam.name}`);

          if (!dryRun) {
            await prisma.team.update({
              where: { id: pstaTeam.id },
              data: {
                isActive: false,
                updatedAt: new Date(),
              },
            });
          }

          result.deactivated++;
          result.deactivatedNames.push(pstaTeam.name);
        }
      }
    } catch (error: any) {
      errorLogger.error('Team sync error', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }

    return result;
  }

  /**
   * Deactivate users not in LDAP
   */
  private async syncUsers(dryRun: boolean): Promise<{
    deactivated: number;
    deactivatedNames: string[];
  }> {
    const result = {
      deactivated: 0,
      deactivatedNames: [] as string[],
    };

    try {
      // Get all LDAP users
      const ldapUsers = await ldapService.getAllUsers();
      const ldapUsernames = ldapUsers.map(u => u.uid).filter(Boolean);

      ldapLogger.info(`Found ${ldapUsers.length} LDAP users`);

      // Get all PSTA users (exclude admin and users without ldapDn)
      const pstaUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          role: { not: 'ADMIN' },
          ldapDn: { not: null },
        },
      });

      // Deactivate users not in LDAP
      for (const pstaUser of pstaUsers) {
        if (!ldapUsernames.includes(pstaUser.username)) {
          ldapLogger.info(`Deactivating user: ${pstaUser.username} (${pstaUser.displayName})`);

          if (!dryRun) {
            await prisma.user.update({
              where: { id: pstaUser.id },
              data: {
                isActive: false,
                updatedAt: new Date(),
              },
            });
          }

          result.deactivated++;
          result.deactivatedNames.push(`${pstaUser.displayName} (${pstaUser.username})`);
        }
      }
    } catch (error: any) {
      errorLogger.error('User sync error', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }

    return result;
  }

  /**
   * Update team memberships for active users
   */
  private async syncTeamMemberships(dryRun: boolean): Promise<{
    updated: number;
  }> {
    const result = {
      updated: 0,
    };

    try {
      // Get all LDAP groups with members
      const ldapGroups = await ldapService.getGroups();
      const ldapUsers = await ldapService.getAllUsers();

      // Get all active PSTA users
      const pstaUsers = await prisma.user.findMany({
        where: { isActive: true, ldapDn: { not: null } },
      });

      // Get all PSTA teams
      const pstaTeams = await prisma.team.findMany({
        where: { isActive: true },
      });

      for (const pstaUser of pstaUsers) {
        // Find LDAP user
        const ldapUser = ldapUsers.find(u => u.uid === pstaUser.username);
        if (!ldapUser) continue;

        // Get LDAP groups for this user
        let userGroups: string[] = [];
        try {
          userGroups = await ldapService.getUserGroups(ldapUser.dn);
        } catch (error: any) {
          ldapLogger.warn(`Failed to get groups for user ${pstaUser.username}`, {
            error: error.message,
          });
          continue;
        }

        // Find first matching team
        let targetTeamId: string | null = null;
        if (userGroups.length > 0) {
          const matchingTeam = pstaTeams.find(t => userGroups.includes(t.name));
          if (matchingTeam) {
            targetTeamId = matchingTeam.id;
          }
        }

        // Update user's team if changed
        if (pstaUser.teamId !== targetTeamId) {
          ldapLogger.info(`Updating team membership for ${pstaUser.username}`, {
            from: pstaUser.teamId,
            to: targetTeamId,
          });

          if (!dryRun) {
            await prisma.user.update({
              where: { id: pstaUser.id },
              data: {
                teamId: targetTeamId,
                updatedAt: new Date(),
              },
            });
          }

          result.updated++;
        }
      }
    } catch (error: any) {
      errorLogger.error('Team membership sync error', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }

    return result;
  }

  /**
   * Save sync history to database
   */
  private async saveSyncHistory(result: SyncResult): Promise<void> {
    try {
      await prisma.systemSetting.upsert({
        where: { key: 'ldap_last_sync' },
        create: {
          id: randomUUID(),
          key: 'ldap_last_sync',
          value: JSON.stringify(result),
          category: 'ldap',
          isEncrypted: false,
          updatedAt: new Date(),
        },
        update: {
          value: JSON.stringify(result),
          updatedAt: new Date(),
        },
      });

      appLogger.info('LDAP sync history saved', {
        timestamp: result.timestamp,
        success: result.success,
      });
    } catch (error: any) {
      errorLogger.error('Failed to save sync history', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Get last sync result from database
   */
  async getLastSyncResult(): Promise<SyncResult | null> {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'ldap_last_sync' },
      });

      if (!setting) return null;

      const result = JSON.parse(setting.value) as SyncResult;
      result.timestamp = new Date(result.timestamp);
      return result;
    } catch (error: any) {
      errorLogger.error('Failed to get last sync result', {
        error: error.message,
        stack: error.stack,
      });
      return null;
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    lastSync: Date | null;
    lastSyncSuccess: boolean;
    ldapGroups: number;
    ldapUsers: number;
    pstaTeams: number;
    pstaActiveUsers: number;
    pstaInactiveUsers: number;
  }> {
    const lastSync = await this.getLastSyncResult();

    const [ldapGroups, ldapUsers, pstaTeams, pstaActiveUsers, pstaInactiveUsers] = await Promise.all([
      ldapService.getGroups().then(g => g.length).catch(() => 0),
      ldapService.getAllUsers().then(u => u.length).catch(() => 0),
      prisma.team.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
    ]);

    return {
      lastSync: lastSync?.timestamp || null,
      lastSyncSuccess: lastSync?.success || false,
      ldapGroups,
      ldapUsers,
      pstaTeams,
      pstaActiveUsers,
      pstaInactiveUsers,
    };
  }
}

export default new LdapSyncService();
