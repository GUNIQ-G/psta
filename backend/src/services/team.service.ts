import { randomUUID } from 'crypto';
import { query, queryOne, transaction } from '../config/database';
import ldapService from '../config/ldap';

class TeamService {
  async getAllTeams() {
    const teams = await query<any>(
      `SELECT * FROM "Team" WHERE "isActive" = true ORDER BY "name" ASC`
    );

    if (teams.length === 0) return teams;

    const teamIds = teams.map((t: any) => t.id);
    const placeholders = teamIds.map((_: any, i: number) => `$${i + 1}`).join(', ');

    const users = await query<any>(
      `SELECT "id", "username", "displayName", "role", "title", "position", "teamId"
       FROM "User"
       WHERE "teamId" IN (${placeholders})`,
      teamIds
    );

    const usersByTeam = new Map<string, any[]>();
    users.forEach((u: any) => {
      if (!usersByTeam.has(u.teamId)) usersByTeam.set(u.teamId, []);
      usersByTeam.get(u.teamId)!.push(u);
    });

    return teams.map((team: any) => ({
      ...team,
      User: usersByTeam.get(team.id) || [],
    }));
  }

  /**
   * Get hierarchical team structure
   * v1.1.18: Returns teams organized in parent-child hierarchy
   */
  async getTeamHierarchy() {
    // Fetch all active teams
    const allTeams = await query<any>(
      `SELECT * FROM "Team" WHERE "isActive" = true ORDER BY "level" ASC, "name" ASC`
    );

    if (allTeams.length === 0) return [];

    const teamIds = allTeams.map((t: any) => t.id);
    const placeholders = teamIds.map((_: any, i: number) => `$${i + 1}`).join(', ');

    // Fetch active users belonging to these teams, ordered by position/title/displayName
    const users = await query<any>(
      `SELECT "id", "username", "displayName", "email", "phoneNumber", "role",
              "title", "position", "departmentNumber", "teamId"
       FROM "User"
       WHERE "teamId" IN (${placeholders})
         AND "isActive" = true
       ORDER BY "position" ASC, "title" ASC, "displayName" ASC`,
      teamIds
    );

    const usersByTeam = new Map<string, any[]>();
    users.forEach((u: any) => {
      if (!usersByTeam.has(u.teamId)) usersByTeam.set(u.teamId, []);
      usersByTeam.get(u.teamId)!.push(u);
    });

    // Build hierarchy: group teams by parent
    const teamMap = new Map<string, any>();
    const rootTeams: any[] = [];

    // First pass: create map of all teams
    allTeams.forEach((team: any) => {
      teamMap.set(team.id, {
        ...team,
        User: usersByTeam.get(team.id) || [],
        children: [],
      });
    });

    // Second pass: build hierarchy
    allTeams.forEach((team: any) => {
      const teamWithChildren = teamMap.get(team.id)!;

      if (team.parentId) {
        const parent = teamMap.get(team.parentId);
        if (parent) {
          parent.children.push(teamWithChildren);
        } else {
          // Parent not found or not active, treat as root
          rootTeams.push(teamWithChildren);
        }
      } else {
        // No parent, this is a root team
        rootTeams.push(teamWithChildren);
      }
    });

    return rootTeams;
  }

  async getTeamById(id: string) {
    const team = await queryOne<any>(
      `SELECT * FROM "Team" WHERE "id" = $1`,
      [id]
    );

    if (!team) return null;

    const users = await query<any>(
      `SELECT "id", "username", "displayName", "email", "role", "isVerified", "isActive"
       FROM "User"
       WHERE "teamId" = $1`,
      [id]
    );

    return {
      ...team,
      User: users,
    };
  }

  async createTeam(data: {
    name: string;
    ldapDn?: string;
    description?: string;
  }) {
    const now = new Date();
    const id = randomUUID();

    return queryOne<any>(
      `INSERT INTO "Team" ("id", "name", "ldapDn", "description", "updatedAt")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, data.name, data.ldapDn ?? null, data.description ?? null, now]
    );
  }

  async updateTeam(
    id: string,
    data: {
      name?: string;
      ldapDn?: string;
      description?: string;
      isActive?: boolean;
    }
  ) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`"name" = $${idx++}`); params.push(data.name); }
    if (data.ldapDn !== undefined) { fields.push(`"ldapDn" = $${idx++}`); params.push(data.ldapDn); }
    if (data.description !== undefined) { fields.push(`"description" = $${idx++}`); params.push(data.description); }
    if (data.isActive !== undefined) { fields.push(`"isActive" = $${idx++}`); params.push(data.isActive); }

    fields.push(`"updatedAt" = $${idx++}`);
    params.push(new Date());

    params.push(id);

    return queryOne<any>(
      `UPDATE "Team" SET ${fields.join(', ')} WHERE "id" = $${idx} RETURNING *`,
      params
    );
  }

  async deleteTeam(id: string) {
    // 먼저 해당 팀의 사용자들을 팀에서 제거
    await query(
      `UPDATE "User" SET "teamId" = NULL, "updatedAt" = $1 WHERE "teamId" = $2`,
      [new Date(), id]
    );

    return queryOne<any>(
      `DELETE FROM "Team" WHERE "id" = $1 RETURNING *`,
      [id]
    );
  }

  async getTeamMembers(teamId: string) {
    const team = await queryOne<any>(
      `SELECT "id" FROM "Team" WHERE "id" = $1`,
      [teamId]
    );

    if (!team) {
      throw new Error('Team not found');
    }

    return query<any>(
      `SELECT "id", "username", "displayName", "email", "role", "isActive", "isVerified"
       FROM "User"
       WHERE "teamId" = $1
         AND "isActive" = true
         AND "isVerified" = true`,
      [teamId]
    );
  }

  /**
   * Reset all teams (delete all teams and clear user team assignments)
   * v1.1.19: Organization initialization feature
   */
  async resetAllTeams() {
    return transaction(async (client) => {
      // 1. Count teams before deletion
      const teamCountResult = await client.query(`SELECT COUNT(*) FROM "Team"`);
      const teamCount = parseInt(teamCountResult.rows[0].count, 10);

      const userCountResult = await client.query(
        `SELECT COUNT(*) FROM "User" WHERE "teamId" IS NOT NULL`
      );
      const userCount = parseInt(userCountResult.rows[0].count, 10);

      // 2. Clear all user team assignments
      await client.query(
        `UPDATE "User" SET "teamId" = NULL, "organizationId" = NULL, "updatedAt" = $1
         WHERE "teamId" IS NOT NULL`,
        [new Date()]
      );

      // 3. Delete all teams
      await client.query(`DELETE FROM "Team"`);

      return {
        deletedTeams: teamCount,
        updatedUsers: userCount,
        message: `Successfully deleted ${teamCount} teams and cleared assignments for ${userCount} users`,
      };
    });
  }

  async syncFromLDAP() {
    try {
      const ldapGroups = await ldapService.getGroups();
      const results = {
        created: 0,
        updated: 0,
        errors: [] as string[],
      };

      for (const group of ldapGroups) {
        try {
          const groupDn = typeof group.dn === 'string' ? group.dn : group.dn.toString();
          const groupDescription = group.description || `LDAP 그룹: ${group.name}`;

          const existing = await queryOne<any>(
            `SELECT * FROM "Team" WHERE "ldapDn" = $1 LIMIT 1`,
            [groupDn]
          );

          if (existing) {
            // Only update if there are actual changes
            if (existing.name !== group.name || existing.description !== groupDescription) {
              await query(
                `UPDATE "Team" SET "name" = $1, "description" = $2, "updatedAt" = $3
                 WHERE "id" = $4`,
                [group.name, groupDescription, new Date(), existing.id]
              );
              results.updated++;
            }
            // If no changes, don't count as updated
          } else {
            await query(
              `INSERT INTO "Team" ("id", "name", "ldapDn", "description", "isActive", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [randomUUID(), group.name, groupDn, groupDescription, true, new Date(), new Date()]
            );
            results.created++;
          }
        } catch (error: any) {
          results.errors.push(`Failed to sync group ${group.name}: ${error.message}`);
        }
      }

      return results;
    } catch (error: any) {
      throw new Error(`LDAP sync failed: ${error.message}`);
    }
  }
}

export default new TeamService();
