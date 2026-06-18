import { LdapService } from '../config/ldap';
import { appLogger, errorLogger, ldapLogger } from '../config/logger';
import { randomUUID } from 'crypto';
import { calculateRoleFromLdap, POSITION_DISPLAY_NAMES } from '../utils/role-mapper';
import { query, queryOne, transaction } from '../config/database';

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
   * Extract hierarchy information from LDAP DN
   * @param dn - LDAP Distinguished Name
   * @returns Level and parent DN
   */
  private extractLdapTeamInfo(dn: string): {
    level: number;
    parentDn: string | null;
  } {
    const dnStr = String(dn);
    const allParts = dnStr.split(',').map(p => p.trim());

    // Filter OU/CN parts for level calculation
    const ouCnParts = allParts.filter(p => {
      const lower = p.toLowerCase();
      return lower.startsWith('ou=') || lower.startsWith('cn=');
    });

    // Level calculation: count OU/CN parts
    const level = ouCnParts.length;

    // Parent DN: remove first OU/CN, keep the rest including dc parts
    let parentDn: string | null = null;
    if (ouCnParts.length > 1) {
      // Find index of first OU/CN part in original DN
      const firstOuCn = ouCnParts[0];
      const firstIndex = allParts.findIndex(p => p === firstOuCn);

      // Parent DN is everything after the first OU/CN
      if (firstIndex >= 0 && firstIndex < allParts.length - 1) {
        parentDn = allParts.slice(firstIndex + 1).join(',');
      }
    }

    return { level, parentDn };
  }

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
   * Sync teams from LDAP groups and organizational units (v1.1.18 - Hierarchical support)
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
      // Get LDAP groups and organizational units
      const ldapGroups = await ldapService.getGroups();
      const ldapOUs = await ldapService.getOrganizationalUnits();

      ldapLogger.info(`Found ${ldapGroups.length} LDAP groups and ${ldapOUs.length} OUs`);

      // Combine groups and OUs with type information
      const allLdapTeams = [
        ...ldapGroups.map(g => ({ ...g, ldapType: 'Group', departmentNumber: undefined })),
        ...ldapOUs.map(o => ({ ...o, ldapType: 'OU' })),  // OUs have departmentNumber from LDAP
      ];

      // Extract hierarchy information and sort by level (parent-first)
      const teamsWithHierarchy = allLdapTeams
        .map(team => {
          const { level, parentDn } = this.extractLdapTeamInfo(team.dn);
          return {
            name: team.name,
            dn: team.dn,
            ldapType: team.ldapType,
            description: team.description,
            departmentNumber: (team as any).departmentNumber,  // v1.1.19: Include departmentNumber
            level,
            parentDn,
          };
        })
        .filter(team => team.name) // Exclude entries without a name
        .sort((a, b) => a.level - b.level); // Process parents first

      ldapLogger.info(`Processing ${teamsWithHierarchy.length} teams with hierarchy`);

      // DN to Team ID mapping (for parent lookup)
      const dnToTeamId = new Map<string, string>();

      // Get all existing PSTA teams
      const pstaTeams = await query<any>('SELECT * FROM "Team"');

      // Build existing DN mapping
      for (const pstaTeam of pstaTeams) {
        if (pstaTeam.ldapDn) {
          dnToTeamId.set(pstaTeam.ldapDn, pstaTeam.id);
        }
      }

      // Create/update teams in order (parents first)
      for (const teamInfo of teamsWithHierarchy) {
        // Find parent team ID
        let parentId: string | null = null;
        if (teamInfo.parentDn) {
          // Try to find parent by DN
          parentId = dnToTeamId.get(teamInfo.parentDn) || null;

          // If not found in memory, try database
          if (!parentId) {
            const parentTeam = await queryOne<{ id: string }>(
              'SELECT id FROM "Team" WHERE "ldapDn" = $1',
              [teamInfo.parentDn]
            );
            if (parentTeam) {
              parentId = parentTeam.id;
              dnToTeamId.set(teamInfo.parentDn, parentId);
            }
          }
        }

        // v1.1.19: Check if team exists (by departmentNumber first, then DN, then name)
        // departmentNumber is the most stable identifier across LDAP server changes
        let existingTeam = teamInfo.departmentNumber
          ? pstaTeams.find((t: any) => t.departmentNumber === teamInfo.departmentNumber)
          : undefined;

        // Fallback to DN matching
        if (!existingTeam) {
          existingTeam = pstaTeams.find((t: any) => t.ldapDn === teamInfo.dn);
        }

        // v1.1.18: Also check by name for migrating from old LDAP server
        // If name matches but DN differs, it's a migration case (e.g., Group → OU, or different LDAP server)
        if (!existingTeam) {
          existingTeam = pstaTeams.find((t: any) => t.name === teamInfo.name);
        }

        if (!existingTeam) {
          // Create new team
          ldapLogger.info(`Creating team: ${teamInfo.name} (level: ${teamInfo.level}, type: ${teamInfo.ldapType})`);

          if (!dryRun) {
            const newTeamId = randomUUID();
            const newTeam = await queryOne<any>(
              `INSERT INTO "Team" (id, name, "ldapDn", "departmentNumber", description, "parentId", level, "ldapType", "isActive", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               RETURNING *`,
              [
                newTeamId,
                teamInfo.name,
                teamInfo.dn,
                teamInfo.departmentNumber || null,
                teamInfo.description || `LDAP ${teamInfo.ldapType}: ${teamInfo.name}`,
                parentId,
                teamInfo.level,
                teamInfo.ldapType,
                true,
                new Date(),
              ]
            );

            // Add to DN mapping
            if (newTeam) {
              dnToTeamId.set(teamInfo.dn, newTeam.id);
            }
          }

          result.created++;
          result.createdNames.push(teamInfo.name);
        } else {
          // Update existing team (reactivate if needed, update hierarchy)
          ldapLogger.info(`Updating team: ${teamInfo.name} (level: ${teamInfo.level})`);

          if (!dryRun) {
            await query(
              `UPDATE "Team"
               SET "isActive" = $1, "ldapDn" = $2, "departmentNumber" = $3, name = $4,
                   "parentId" = $5, level = $6, "ldapType" = $7, description = $8, "updatedAt" = $9
               WHERE id = $10`,
              [
                true,
                teamInfo.dn,
                teamInfo.departmentNumber || existingTeam.departmentNumber,
                teamInfo.name,
                parentId,
                teamInfo.level,
                teamInfo.ldapType,
                teamInfo.description || existingTeam.description,
                new Date(),
                existingTeam.id,
              ]
            );
          }

          // Ensure mapping is up to date
          dnToTeamId.set(teamInfo.dn, existingTeam.id);

          // Count as created if was inactive
          if (!existingTeam.isActive) {
            result.created++;
            result.createdNames.push(teamInfo.name);
          }
        }
      }

      // Deactivate teams not in LDAP (only those with ldapDn)
      const ldapDns = teamsWithHierarchy.map(t => t.dn);

      // v1.1.18: Re-fetch teams after updates to get current ldapDn values
      const updatedPstaTeams = await query<any>('SELECT * FROM "Team"');

      for (const pstaTeam of updatedPstaTeams) {
        if (pstaTeam.ldapDn && !ldapDns.includes(pstaTeam.ldapDn) && pstaTeam.isActive) {
          ldapLogger.info(`Deactivating team: ${pstaTeam.name}`);

          if (!dryRun) {
            await query(
              'UPDATE "Team" SET "isActive" = $1, "updatedAt" = $2 WHERE id = $3',
              [false, new Date(), pstaTeam.id]
            );
          }

          result.deactivated++;
          result.deactivatedNames.push(pstaTeam.name);
        }
      }

      ldapLogger.info('Team sync completed', {
        created: result.created,
        deactivated: result.deactivated,
      });
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
      const pstaUsers = await query<any>(
        `SELECT * FROM "User"
         WHERE "isActive" = true AND role != 'ADMIN' AND "ldapDn" IS NOT NULL`
      );

      // Deactivate users not in LDAP
      for (const pstaUser of pstaUsers) {
        if (!ldapUsernames.includes(pstaUser.username)) {
          ldapLogger.info(`Deactivating user: ${pstaUser.username} (${pstaUser.displayName})`);

          if (!dryRun) {
            await query(
              'UPDATE "User" SET "isActive" = $1, "updatedAt" = $2 WHERE id = $3',
              [false, new Date(), pstaUser.id]
            );
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
   * Decode LDAP escaped string (e.g., \xx hex escapes to UTF-8)
   * v1.1.18: Helper function to decode LDAP DN escape sequences
   */
  private decodeLdapString(str: string): string {
    if (!str) return str;

    try {
      // Check if string contains hex escape sequences like \xx
      const hexPattern = /\\([0-9a-fA-F]{2})/g;

      // If no hex escapes found, return original string (it's likely already valid UTF-8)
      if (!hexPattern.test(str)) {
        return str;
      }

      // Reset regex state
      hexPattern.lastIndex = 0;

      // Replace hex escapes with actual bytes
      const bytes: number[] = [];
      let lastIndex = 0;
      let match;

      while ((match = hexPattern.exec(str)) !== null) {
        // Add any normal characters before the escape as UTF-8 bytes
        const normalPart = str.substring(lastIndex, match.index);
        const normalBytes = Buffer.from(normalPart, 'utf8');
        for (const b of normalBytes) {
          bytes.push(b);
        }
        // Add the hex byte
        bytes.push(parseInt(match[1], 16));
        lastIndex = hexPattern.lastIndex;
      }

      // Add remaining normal characters as UTF-8 bytes
      const remainingPart = str.substring(lastIndex);
      const remainingBytes = Buffer.from(remainingPart, 'utf8');
      for (const b of remainingBytes) {
        bytes.push(b);
      }

      return Buffer.from(bytes).toString('utf8');
    } catch (error) {
      // If decoding fails, return original string
      return str;
    }
  }

  /**
   * Update team memberships for active users
   * v1.1.18: Enhanced to support OU-based teams
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
      const pstaUsers = await query<any>(
        'SELECT * FROM "User" WHERE "isActive" = true AND "ldapDn" IS NOT NULL'
      );

      // Get all PSTA teams
      const pstaTeams = await query<any>(
        'SELECT * FROM "Team" WHERE "isActive" = true'
      );

      for (const pstaUser of pstaUsers) {
        // Find LDAP user
        const ldapUser = ldapUsers.find(u => u.uid === pstaUser.username);
        if (!ldapUser) continue;

        // v1.1.19: Try to find team by departmentNumber first (most stable)
        let targetTeamId: string | null = null;

        if (ldapUser.departmentNumber) {
          const deptTeam = pstaTeams.find((t: any) => t.departmentNumber === ldapUser.departmentNumber);
          if (deptTeam) {
            targetTeamId = deptTeam.id;
            ldapLogger.debug(`Matched ${pstaUser.username} to team by departmentNumber: ${deptTeam.name} (${ldapUser.departmentNumber})`);
          }
        }

        // Fallback: v1.1.18: Try to find team from DN's OU structure
        if (!targetTeamId && ldapUser.dn) {
          // Parse OU from DN (closest OU to user)
          const dnParts = ldapUser.dn.split(',');
          const ouParts = dnParts.filter((p: string) => p.trim().toLowerCase().startsWith('ou='));

          if (ouParts.length > 0) {
            // Get the first (closest) OU name
            // v1.1.18: Decode LDAP escape sequences (e.g., \ec\84\9c -> 서)
            const closestOu = this.decodeLdapString(ouParts[0].split('=')[1]);

            // Find matching team by name (OU teams have ldapType='OU')
            const ouTeam = pstaTeams.find((t: any) =>
              t.name === closestOu && t.ldapType === 'OU'
            );

            if (ouTeam) {
              targetTeamId = ouTeam.id;
              ldapLogger.debug(`Matched ${pstaUser.username} to OU team: ${ouTeam.name}`);
            }
          }
        }

        // Fallback to Group-based matching if no OU match
        if (!targetTeamId) {
          let userGroups: string[] = [];
          try {
            userGroups = await ldapService.getUserGroups(ldapUser.dn);
          } catch (error: any) {
            ldapLogger.warn(`Failed to get groups for user ${pstaUser.username}`, {
              error: error.message,
            });
          }

          if (userGroups.length > 0) {
            const matchingTeam = pstaTeams.find((t: any) => userGroups.includes(t.name));
            if (matchingTeam) {
              targetTeamId = matchingTeam.id;
              ldapLogger.debug(`Matched ${pstaUser.username} to Group team: ${matchingTeam.name}`);
            }
          }
        }

        // v1.1.20: Calculate positionType and role from LDAP employeeType
        const { positionType, role } = calculateRoleFromLdap(
          ldapUser.employeeType,
          pstaUser.roleOverride  // Preserve manual override if exists
        );

        // v1.1.18: Check if team or job info changed
        const jobInfoChanged =
          pstaUser.teamId !== targetTeamId ||
          pstaUser.title !== (ldapUser.title || null) ||
          pstaUser.position !== (ldapUser.employeeType || null) ||
          pstaUser.positionType !== positionType ||
          pstaUser.role !== role ||
          pstaUser.departmentNumber !== (ldapUser.departmentNumber || null);

        if (jobInfoChanged) {
          ldapLogger.info(`Updating user info for ${pstaUser.username}`, {
            teamId: { from: pstaUser.teamId, to: targetTeamId },
            title: { from: pstaUser.title, to: ldapUser.title || null },
            position: { from: pstaUser.position, to: ldapUser.employeeType || null },
            positionType: { from: pstaUser.positionType, to: positionType },
            role: { from: pstaUser.role, to: role },
            departmentNumber: { from: pstaUser.departmentNumber, to: ldapUser.departmentNumber || null },
          });

          if (!dryRun) {
            await query(
              `UPDATE "User"
               SET "teamId" = $1, title = $2, position = $3, "positionType" = $4,
                   role = $5, "departmentNumber" = $6, "updatedAt" = $7
               WHERE id = $8`,
              [
                targetTeamId,
                ldapUser.title || null,
                ldapUser.employeeType || null,
                positionType,
                role,
                ldapUser.departmentNumber || null,
                new Date(),
                pstaUser.id,
              ]
            );
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
      const now = new Date();
      const valueJson = JSON.stringify(result);

      await query(
        `INSERT INTO "SystemSetting" (id, key, value, category, "isEncrypted", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (key) DO UPDATE SET value = $3, "updatedAt" = $6`,
        [randomUUID(), 'ldap_last_sync', valueJson, 'ldap', false, now]
      );

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
      const setting = await queryOne<{ value: string }>(
        'SELECT value FROM "SystemSetting" WHERE key = $1',
        ['ldap_last_sync']
      );

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

    const [ldapGroups, ldapUsers, pstaTeamsRows, pstaActiveUsersRows, pstaInactiveUsersRows] = await Promise.all([
      ldapService.getGroups().then(g => g.length).catch(() => 0),
      ldapService.getAllUsers().then(u => u.length).catch(() => 0),
      queryOne<{ count: string }>('SELECT COUNT(*) as count FROM "Team" WHERE "isActive" = true'),
      queryOne<{ count: string }>('SELECT COUNT(*) as count FROM "User" WHERE "isActive" = true'),
      queryOne<{ count: string }>('SELECT COUNT(*) as count FROM "User" WHERE "isActive" = false'),
    ]);

    return {
      lastSync: lastSync?.timestamp || null,
      lastSyncSuccess: lastSync?.success || false,
      ldapGroups,
      ldapUsers,
      pstaTeams: parseInt(pstaTeamsRows?.count || '0', 10),
      pstaActiveUsers: parseInt(pstaActiveUsersRows?.count || '0', 10),
      pstaInactiveUsers: parseInt(pstaInactiveUsersRows?.count || '0', 10),
    };
  }

  /**
   * Preview LDAP users before sync
   * Returns all LDAP users with their current status in PSTA
   */
  async previewLdapUsers(): Promise<{
    ldapUsers: Array<{
      uid: string;
      cn: string;
      displayName: string;
      mail: string;
      dn: string;
      groups: string[];
      existsInPsta: boolean;
      pstaStatus: 'active' | 'inactive' | 'not_found';
      pstaTeam: string | null;
    }>;
    totalCount: number;
  }> {
    try {
      // Get all LDAP users
      const ldapUsers = await ldapService.getAllUsers();
      const ldapGroups = await ldapService.getGroups();

      // Get all PSTA users with team info
      const pstaUsers = await query<any>(
        'SELECT u.*, t.name as "teamName" FROM "User" u LEFT JOIN "Team" t ON u."teamId" = t.id'
      );

      // Build user preview list
      const userPreviews = await Promise.all(
        ldapUsers.map(async (ldapUser) => {
          // Find matching PSTA user
          const pstaUser = pstaUsers.find((u: any) => u.username === ldapUser.uid);

          // Get user's LDAP groups
          let userGroups: string[] = [];
          try {
            userGroups = await ldapService.getUserGroups(ldapUser.dn);
          } catch (error) {
            ldapLogger.warn(`Failed to get groups for user ${ldapUser.uid}`);
          }

          return {
            uid: ldapUser.uid || '',
            cn: ldapUser.cn || '',
            displayName: ldapUser.displayName || ldapUser.cn || '',
            mail: ldapUser.mail || '',
            dn: ldapUser.dn,
            groups: userGroups,
            existsInPsta: !!pstaUser,
            pstaStatus: pstaUser
              ? (pstaUser.isActive ? 'active' : 'inactive')
              : 'not_found' as 'active' | 'inactive' | 'not_found',
            pstaTeam: pstaUser?.teamName || null,
          };
        })
      );

      ldapLogger.info('LDAP users preview generated', {
        totalCount: userPreviews.length,
      });

      return {
        ldapUsers: userPreviews,
        totalCount: userPreviews.length,
      };
    } catch (error: any) {
      errorLogger.error('Failed to preview LDAP users', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Selective sync - sync only selected users from LDAP
   * @param selectedUserDns - Array of LDAP DNs to sync
   * @param dryRun - If true, only simulates changes without applying them
   */
  async selectiveSync(selectedUserDns: string[], dryRun: boolean = false): Promise<SyncResult> {
    const startTime = new Date();
    ldapLogger.info('Starting selective LDAP sync', {
      selectedCount: selectedUserDns.length,
      dryRun,
    });

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
      // Step 1: Get all LDAP users and filter selected ones
      const allLdapUsers = await ldapService.getAllUsers();
      const selectedUsers = allLdapUsers.filter(user =>
        selectedUserDns.includes(user.dn)
      );

      ldapLogger.info(`Processing ${selectedUsers.length} selected users`);

      // Step 2: Sync teams from selected users' groups
      const userGroups = new Set<string>();
      for (const user of selectedUsers) {
        try {
          const groups = await ldapService.getUserGroups(user.dn);
          groups.forEach(g => userGroups.add(g));
        } catch (error: any) {
          ldapLogger.warn(`Failed to get groups for user ${user.uid}`, {
            error: error.message,
          });
        }
      }

      // Get LDAP groups that match user groups
      const ldapGroups = await ldapService.getGroups();
      const relevantGroups = ldapGroups.filter(g => userGroups.has(g.name));

      // Create missing teams
      const pstaTeams = await query<any>('SELECT * FROM "Team"');
      for (const ldapGroup of relevantGroups) {
        if (!ldapGroup.name) continue;

        const existingTeam = pstaTeams.find((t: any) => t.name === ldapGroup.name);

        if (!existingTeam) {
          ldapLogger.info(`Creating team: ${ldapGroup.name}`);

          if (!dryRun) {
            await query(
              `INSERT INTO "Team" (id, name, "ldapDn", description, "isActive", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                randomUUID(),
                ldapGroup.name,
                ldapGroup.dn,
                ldapGroup.description || `LDAP 그룹: ${ldapGroup.name}`,
                true,
                new Date(),
              ]
            );
          }

          result.teamsCreated++;
          result.details.teamsCreated.push(ldapGroup.name);
        } else if (!existingTeam.isActive) {
          // Reactivate deactivated team
          ldapLogger.info(`Reactivating team: ${ldapGroup.name}`);

          if (!dryRun) {
            await query(
              'UPDATE "Team" SET "isActive" = $1, "ldapDn" = $2, "updatedAt" = $3 WHERE id = $4',
              [true, ldapGroup.dn, new Date(), existingTeam.id]
            );
          }
        }
      }

      // Refresh team list after creation
      const updatedPstaTeams = await query<any>(
        'SELECT * FROM "Team" WHERE "isActive" = true'
      );

      // Step 3: Create or reactivate selected users and update team memberships
      for (const ldapUser of selectedUsers) {
        if (!ldapUser.uid) continue;

        try {
          // Find existing PSTA user
          const existingUser = await queryOne<any>(
            'SELECT * FROM "User" WHERE username = $1',
            [ldapUser.uid]
          );

          // Get user's groups and find matching team
          let userGroupNames: string[] = [];
          try {
            userGroupNames = await ldapService.getUserGroups(ldapUser.dn);
          } catch (error: any) {
            ldapLogger.warn(`Failed to get groups for user ${ldapUser.uid}`);
          }

          let targetTeamId: string | null = null;
          if (userGroupNames.length > 0) {
            const matchingTeam = updatedPstaTeams.find((t: any) =>
              userGroupNames.includes(t.name)
            );
            if (matchingTeam) {
              targetTeamId = matchingTeam.id;
            }
          }

          if (!existingUser) {
            // Create new user
            ldapLogger.info(`Creating user: ${ldapUser.uid} (${ldapUser.displayName})`);

            if (!dryRun) {
              await query(
                `INSERT INTO "User" (id, username, email, "displayName", "phoneNumber", "ldapDn", role, "teamId", "isActive", "isVerified", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                  randomUUID(),
                  ldapUser.uid,
                  ldapUser.mail || `${ldapUser.uid}@example.com`,
                  ldapUser.displayName || ldapUser.cn || ldapUser.uid,
                  ldapUser.telephoneNumber || null,
                  ldapUser.dn,
                  'MEMBER',
                  targetTeamId,
                  true,
                  true,
                  new Date(),
                ]
              );
            }

            result.teamMembershipsUpdated++;
          } else {
            // Update existing user
            const needsUpdate =
              !existingUser.isActive ||
              existingUser.teamId !== targetTeamId ||
              existingUser.ldapDn !== ldapUser.dn;

            if (needsUpdate) {
              ldapLogger.info(`Updating user: ${ldapUser.uid}`, {
                reactivating: !existingUser.isActive,
                teamChange: existingUser.teamId !== targetTeamId,
              });

              if (!dryRun) {
                await query(
                  `UPDATE "User"
                   SET "isActive" = $1, "teamId" = $2, "ldapDn" = $3, "displayName" = $4,
                       email = $5, "phoneNumber" = $6, "updatedAt" = $7
                   WHERE id = $8`,
                  [
                    true,
                    targetTeamId,
                    ldapUser.dn,
                    ldapUser.displayName || ldapUser.cn || ldapUser.uid,
                    ldapUser.mail || existingUser.email,
                    ldapUser.telephoneNumber || existingUser.phoneNumber,
                    new Date(),
                    existingUser.id,
                  ]
                );
              }

              result.teamMembershipsUpdated++;
            }
          }
        } catch (error: any) {
          const errorMsg = `Failed to sync user ${ldapUser.uid}: ${error.message}`;
          result.errors.push(errorMsg);
          errorLogger.error('User sync error in selective sync', {
            uid: ldapUser.uid,
            error: error.message,
            stack: error.stack,
          });
        }
      }

      result.success = true;
      ldapLogger.info('Selective LDAP sync completed', {
        teamsCreated: result.teamsCreated,
        teamMembershipsUpdated: result.teamMembershipsUpdated,
        errors: result.errors.length,
        dryRun,
      });
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
      errorLogger.error('Selective LDAP sync failed', {
        error: error.message,
        stack: error.stack,
      });
    }

    // Save sync history
    if (!dryRun && result.success) {
      await this.saveSyncHistory(result);
    }

    return result;
  }

  /**
   * v1.1.19: Preview hierarchical LDAP structure with organizations and users
   * Returns tree structure suitable for Ant Design Tree component
   */
  async previewHierarchicalLdap(): Promise<{
    tree: Array<{
      key: string;
      title: string;
      type: 'organization' | 'user';
      dn: string;
      children?: any[];
      // Additional user info
      uid?: string;
      email?: string;
      userTitle?: string;
      department?: string;
      pstaStatus?: 'active' | 'inactive' | 'not_found';
      pstaTeam?: string | null;
    }>;
    totalOrgs: number;
    totalUsers: number;
  }> {
    try {
      ldapLogger.info('Starting hierarchical LDAP preview');

      // Get active LDAP config
      const ldapConfig = await queryOne<any>(
        'SELECT * FROM "LdapConfig" WHERE "isActive" = true ORDER BY "createdAt" DESC LIMIT 1'
      );

      if (!ldapConfig) {
        throw new Error('No active LDAP configuration found');
      }

      // Get all LDAP organizational units
      const ldapOUs = await ldapService.getAllOrganizationalUnits();
      ldapLogger.info(`Found ${ldapOUs.length} organizational units`);

      // Get all LDAP users
      const ldapUsers = await ldapService.getAllUsers();
      ldapLogger.info(`Found ${ldapUsers.length} users`);

      // Get all PSTA users for status mapping
      const pstaUsers = await query<any>(
        'SELECT u.*, t.name as "teamName" FROM "User" u LEFT JOIN "Team" t ON u."teamId" = t.id'
      );

      // Build organization tree
      const orgBaseDn = ldapConfig.orgBaseDn || `ou=organization,${ldapConfig.searchBase}`;
      const hiddenOrgs = ldapConfig.hiddenOrgs
        ? ldapConfig.hiddenOrgs.split(',').map((o: string) => o.trim().toLowerCase())
        : [];

      // Filter and process OUs
      const filteredOUs = ldapOUs.filter(ou => {
        // Skip root OUs like 'people', 'organization', etc.
        const ouName = ou.name?.toLowerCase() || '';
        const skipOUs = ['people', 'groups', 'organization'];
        if (skipOUs.includes(ouName)) return false;

        // Skip hidden organizations
        if (hiddenOrgs.includes(ouName)) return false;

        return true;
      });

      // Build OU hierarchy map (DN -> node) and departmentNumber -> node
      const ouMap = new Map<string, any>();
      const deptNumMap = new Map<string, any>(); // departmentNumber -> node
      const rootNodes: any[] = [];

      // Sort OUs by DN length (shorter = higher level)
      const sortedOUs = [...filteredOUs].sort((a, b) => {
        const aDepth = (a.dn?.match(/,/g) || []).length;
        const bDepth = (b.dn?.match(/,/g) || []).length;
        return aDepth - bDepth;
      });

      for (const ou of sortedOUs) {
        if (!ou.dn || !ou.name) continue;

        const node = {
          key: `org-${ou.dn}`,
          title: this.decodeLdapString(ou.name),
          type: 'organization' as const,
          dn: ou.dn,
          children: [] as any[],
          description: ou.description,
          departmentNumber: ou.departmentNumber,
        };

        ouMap.set(ou.dn, node);

        // Also map by departmentNumber for user matching
        if (ou.departmentNumber) {
          deptNumMap.set(ou.departmentNumber, node);
        }

        // Find parent DN
        const parentDn = this.getParentDn(ou.dn);
        const parentNode = parentDn ? ouMap.get(parentDn) : null;

        if (parentNode) {
          parentNode.children.push(node);
        } else {
          // No parent found, add as root
          rootNodes.push(node);
        }
      }

      // Map users to organizations based on their DN structure or 'ou' attribute
      for (const ldapUser of ldapUsers) {
        if (!ldapUser.uid) continue;

        // Find PSTA user status
        const pstaUser = pstaUsers.find((u: any) => u.username === ldapUser.uid);

        // Get user's department from DN structure or attributes
        let userDept = '';
        let userOrgDn = '';

        // Method 1: Parse DN to find the closest OU
        // DN example: uid=xxx,ou=Engineering,ou=organization,dc=ldap,dc=example,dc=com
        if (ldapUser.dn) {
          const dnParts = ldapUser.dn.split(',');
          // Find the first OU part (skip the uid= part)
          for (let i = 0; i < dnParts.length; i++) {
            const part = dnParts[i].trim();
            if (part.toLowerCase().startsWith('ou=')) {
              const ouName = part.substring(3); // Remove 'ou='
              const decodedOuName = this.decodeLdapString(ouName);

              // Skip system OUs like 'people', 'organization', 'groups'
              const skipOUs = ['people', 'organization', 'groups', 'users'];
              if (!skipOUs.includes(decodedOuName.toLowerCase())) {
                userDept = decodedOuName;
                // Build the org DN from this point
                userOrgDn = dnParts.slice(i).join(',');
                break;
              }
            }
          }
        }

        // Method 2: Fallback to attributes if DN parsing didn't work
        if (!userDept) {
          for (const attr of ['ou', 'department', 'departmentNumber']) {
            if ((ldapUser as any)[attr]) {
              userDept = this.decodeLdapString((ldapUser as any)[attr]);
              break;
            }
          }
        }

        // Build user node
        const userNode = {
          key: `user-${ldapUser.dn}`,
          title: this.buildDisplayName(ldapUser, ldapConfig.displayNameFormat || '{sn}{cn}'),
          type: 'user' as const,
          dn: ldapUser.dn,
          uid: ldapUser.uid,
          email: ldapUser.mail || '',
          userTitle: ldapUser.title || '',
          department: userDept,
          pstaStatus: pstaUser
            ? (pstaUser.isActive ? 'active' : 'inactive')
            : 'not_found' as 'active' | 'inactive' | 'not_found',
          pstaTeam: pstaUser?.teamName || null,
        };

        // Find organization node to attach user to
        let attached = false;

        // Try Method 1: Match by departmentNumber (most accurate for this LDAP structure)
        const userDeptNum = ldapUser.departmentNumber;
        if (userDeptNum && deptNumMap.has(userDeptNum)) {
          deptNumMap.get(userDeptNum)!.children.push(userNode);
          attached = true;
        }

        // Try Method 2: Match by DN (if user's DN contains org info)
        if (!attached && userOrgDn && ouMap.has(userOrgDn)) {
          ouMap.get(userOrgDn)!.children.push(userNode);
          attached = true;
        }

        // Try Method 3: Match by organization name
        if (!attached && userDept) {
          for (const [dn, orgNode] of ouMap.entries()) {
            // Exact match
            if (orgNode.title === userDept) {
              orgNode.children.push(userNode);
              attached = true;
              break;
            }
          }
        }

        // Try Method 4: Partial match by organization name
        if (!attached && userDept) {
          for (const [dn, orgNode] of ouMap.entries()) {
            if (orgNode.title.includes(userDept) || userDept.includes(orgNode.title)) {
              orgNode.children.push(userNode);
              attached = true;
              break;
            }
          }
        }

        // If not attached to any org, add to root
        if (!attached) {
          // Create "Unassigned" node if not exists
          let unassignedNode = rootNodes.find(n => n.key === 'org-unassigned');
          if (!unassignedNode) {
            unassignedNode = {
              key: 'org-unassigned',
              title: '미배정',
              type: 'organization' as const,
              dn: '',
              children: [],
            };
            rootNodes.push(unassignedNode);
          }
          unassignedNode.children.push(userNode);
        }
      }

      // Sort children in each node
      const sortNodes = (nodes: any[]) => {
        nodes.sort((a, b) => {
          // Organizations first, then users
          if (a.type !== b.type) {
            return a.type === 'organization' ? -1 : 1;
          }
          return a.title.localeCompare(b.title, 'ko');
        });

        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            sortNodes(node.children);
          }
        }
      };

      sortNodes(rootNodes);

      // Remove empty organization nodes
      const removeEmptyOrgs = (nodes: any[]): any[] => {
        return nodes.filter(node => {
          if (node.type === 'user') return true;
          if (node.children) {
            node.children = removeEmptyOrgs(node.children);
          }
          // Keep org only if it has children
          return node.children && node.children.length > 0;
        });
      };

      const finalTree = removeEmptyOrgs(rootNodes);

      // Debug: Log departmentNumber mapping
      ldapLogger.info('DEBUG: DepartmentNumber mapping', {
        deptNumMap: Array.from(deptNumMap.entries()).map(([k, v]) => ({
          deptNum: k,
          orgName: v.title,
        })),
      });

      ldapLogger.info('Hierarchical LDAP preview generated', {
        totalOrgs: filteredOUs.length,
        totalUsers: ldapUsers.length,
        treeRoots: finalTree.length,
      });

      return {
        tree: finalTree,
        totalOrgs: filteredOUs.length,
        totalUsers: ldapUsers.length,
      };
    } catch (error: any) {
      errorLogger.error('Failed to generate hierarchical LDAP preview', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Helper: Get parent DN from a DN string
   */
  private getParentDn(dn: string): string | null {
    const parts = dn.split(',');
    if (parts.length <= 1) return null;
    return parts.slice(1).join(',');
  }

  /**
   * Helper: Build display name from LDAP user attributes
   */
  private buildDisplayName(ldapUser: any, format: string): string {
    // Format examples: "{sn}{cn}", "{cn}", "{sn} {cn}"
    let result = format;

    result = result.replace('{sn}', ldapUser.sn || '');
    result = result.replace('{cn}', ldapUser.cn || '');
    result = result.replace('{uid}', ldapUser.uid || '');
    result = result.replace('{displayName}', ldapUser.displayName || '');

    // Fallback if empty
    if (!result.trim()) {
      result = ldapUser.displayName || ldapUser.cn || ldapUser.uid || 'Unknown';
    }

    return result.trim();
  }

  /**
   * v1.1.19: Apply selected LDAP items to PSTA
   * @param selectedKeys - Array of selected keys (both org and user)
   * @param dryRun - If true, only simulates changes
   */
  async applySelectedLdapItems(selectedKeys: string[], dryRun: boolean = false): Promise<SyncResult> {
    const startTime = new Date();
    ldapLogger.info('Starting selective LDAP apply', {
      selectedCount: selectedKeys.length,
      dryRun,
    });

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
      // Separate organization and user keys
      const orgKeys = selectedKeys.filter(k => k.startsWith('org-'));
      const userKeys = selectedKeys.filter(k => k.startsWith('user-'));

      // Extract DNs from keys
      const orgDns = orgKeys.map(k => k.replace('org-', '')).filter(dn => dn && dn !== 'unassigned');
      const userDns = userKeys.map(k => k.replace('user-', ''));

      ldapLogger.info('Processing selection', {
        organizations: orgDns.length,
        users: userDns.length,
      });

      // Step 1: Create/update teams from selected organizations
      if (orgDns.length > 0) {
        const ldapOUs = await ldapService.getAllOrganizationalUnits();
        const pstaTeams = await query<any>('SELECT * FROM "Team"');

        for (const orgDn of orgDns) {
          const ldapOU = ldapOUs.find(ou => ou.dn === orgDn);
          if (!ldapOU || !ldapOU.name) continue;

          const decodedName = this.decodeLdapString(ldapOU.name);
          const existingTeam = pstaTeams.find((t: any) => t.ldapDn === orgDn || t.name === decodedName);

          if (!existingTeam) {
            ldapLogger.info(`Creating team: ${decodedName}`);

            if (!dryRun) {
              const { level, parentDn } = this.extractLdapTeamInfo(orgDn);
              let parentId: string | null = null;

              if (parentDn) {
                const parentTeam = await queryOne<{ id: string }>(
                  'SELECT id FROM "Team" WHERE "ldapDn" = $1 LIMIT 1',
                  [parentDn]
                );
                parentId = parentTeam?.id || null;
              }

              await query(
                `INSERT INTO "Team" (id, name, "ldapDn", "departmentNumber", description, "parentId", level, "ldapType", "isActive", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                  randomUUID(),
                  decodedName,
                  orgDn,
                  ldapOU.departmentNumber || null,
                  ldapOU.description || `LDAP OU: ${decodedName}`,
                  parentId,
                  level,
                  'OU',
                  true,
                  new Date(),
                ]
              );
            }

            result.teamsCreated++;
            result.details.teamsCreated.push(decodedName);
          } else if (!existingTeam.isActive) {
            ldapLogger.info(`Reactivating team: ${decodedName}`);

            if (!dryRun) {
              await query(
                'UPDATE "Team" SET "isActive" = $1, "ldapDn" = $2, "updatedAt" = $3 WHERE id = $4',
                [true, orgDn, new Date(), existingTeam.id]
              );
            }

            result.teamsCreated++;
            result.details.teamsCreated.push(decodedName);
          }
        }
      }

      // Step 2: Create/update users from selected user keys
      if (userDns.length > 0) {
        const allLdapUsers = await ldapService.getAllUsers();
        const selectedUsers = allLdapUsers.filter(u => userDns.includes(u.dn));

        // Refresh team list after creation
        const updatedTeams = await query<any>(
          'SELECT * FROM "Team" WHERE "isActive" = true'
        );

        // Get LDAP config for attribute mapping
        const ldapConfig = await queryOne<any>(
          'SELECT * FROM "LdapConfig" WHERE "isActive" = true ORDER BY "createdAt" DESC LIMIT 1'
        );

        for (const ldapUser of selectedUsers) {
          if (!ldapUser.uid) continue;

          try {
            const existingUser = await queryOne<any>(
              'SELECT * FROM "User" WHERE username = $1',
              [ldapUser.uid]
            );

            // v1.1.19: Find team based on user's departmentNumber first (most stable)
            let targetTeamId: string | null = null;

            if (ldapUser.departmentNumber) {
              const matchingTeam = updatedTeams.find((t: any) => t.departmentNumber === ldapUser.departmentNumber);
              if (matchingTeam) {
                targetTeamId = matchingTeam.id;
                ldapLogger.debug(`Matched ${ldapUser.uid} to team by departmentNumber: ${matchingTeam.name}`);
              }
            }

            // Fallback: match by OU name
            if (!targetTeamId) {
              const userDept = ldapUser.ou || '';
              if (userDept) {
                const decodedDept = this.decodeLdapString(userDept);
                const matchingTeam = updatedTeams.find((t: any) =>
                  t.name === decodedDept || t.name.includes(decodedDept)
                );
                if (matchingTeam) {
                  targetTeamId = matchingTeam.id;
                }
              }
            }

            const displayName = ldapConfig
              ? this.buildDisplayName(ldapUser, ldapConfig.displayNameFormat || '{sn}{cn}')
              : ldapUser.displayName || ldapUser.cn || ldapUser.uid;

            if (!existingUser) {
              // v1.1.20: Calculate positionType and role from LDAP
              const { positionType, role } = calculateRoleFromLdap(ldapUser.employeeType, null);

              ldapLogger.info(`Creating user: ${ldapUser.uid} (${displayName})`, {
                positionType,
                role,
              });

              if (!dryRun) {
                await query(
                  `INSERT INTO "User" (id, username, email, "displayName", "phoneNumber", "ldapDn", role, "positionType", "teamId", title, position, "departmentNumber", "isActive", "isVerified", "updatedAt")
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                  [
                    randomUUID(),
                    ldapUser.uid,
                    ldapUser.mail || `${ldapUser.uid}@example.com`,
                    displayName,
                    ldapUser.telephoneNumber || null,
                    ldapUser.dn,
                    role,
                    positionType,
                    targetTeamId,
                    ldapUser.title || null,
                    ldapUser.employeeType || null,
                    ldapUser.departmentNumber || null,
                    true,
                    true,
                    new Date(),
                  ]
                );
              }

              result.teamMembershipsUpdated++;
            } else {
              // v1.1.20: Calculate positionType and role from LDAP
              const { positionType, role } = calculateRoleFromLdap(
                ldapUser.employeeType,
                existingUser.roleOverride  // Preserve manual override if exists
              );

              // Update existing user
              const needsUpdate =
                !existingUser.isActive ||
                existingUser.teamId !== targetTeamId ||
                existingUser.ldapDn !== ldapUser.dn ||
                existingUser.displayName !== displayName ||
                existingUser.positionType !== positionType ||
                existingUser.role !== role;

              if (needsUpdate) {
                ldapLogger.info(`Updating user: ${ldapUser.uid}`, {
                  reactivating: !existingUser.isActive,
                  teamChange: existingUser.teamId !== targetTeamId,
                  positionType,
                  role,
                });

                if (!dryRun) {
                  await query(
                    `UPDATE "User"
                     SET "isActive" = $1, "teamId" = $2, "ldapDn" = $3, "displayName" = $4,
                         email = $5, "phoneNumber" = $6, title = $7, position = $8,
                         "positionType" = $9, role = $10, "departmentNumber" = $11, "updatedAt" = $12
                     WHERE id = $13`,
                    [
                      true,
                      targetTeamId,
                      ldapUser.dn,
                      displayName,
                      ldapUser.mail || existingUser.email,
                      ldapUser.telephoneNumber || existingUser.phoneNumber,
                      ldapUser.title || existingUser.title,
                      ldapUser.employeeType || existingUser.position,
                      positionType,
                      role,
                      ldapUser.departmentNumber || existingUser.departmentNumber,
                      new Date(),
                      existingUser.id,
                    ]
                  );
                }

                result.teamMembershipsUpdated++;
              }
            }
          } catch (error: any) {
            const errorMsg = `Failed to sync user ${ldapUser.uid}: ${error.message}`;
            result.errors.push(errorMsg);
            errorLogger.error('User sync error in apply', {
              uid: ldapUser.uid,
              error: error.message,
            });
          }
        }
      }

      result.success = true;
      ldapLogger.info('Selective LDAP apply completed', {
        teamsCreated: result.teamsCreated,
        teamMembershipsUpdated: result.teamMembershipsUpdated,
        errors: result.errors.length,
        dryRun,
      });
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
      errorLogger.error('Selective LDAP apply failed', {
        error: error.message,
        stack: error.stack,
      });
    }

    // Save sync history
    if (!dryRun && result.success) {
      await this.saveSyncHistory(result);
    }

    return result;
  }
}

export default new LdapSyncService();
