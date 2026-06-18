import { randomUUID } from 'crypto';
import { query, queryOne } from '../config/database';
import { UserRole } from '../types/enums';

class UserService {
  async getAllUsers(includeInactive = false, includeRetired = false) {
    // v1.1.18: Exclude 퇴사자 and 휴직자 by default
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (!includeInactive) {
      conditions.push(`u."isActive" = true`);
    }

    conditions.push(`u.role != $${paramIdx}`);
    params.push(UserRole.ADMIN);
    paramIdx++;

    if (!includeRetired) {
      conditions.push(`(t.name IS NULL OR t.name NOT IN ($${paramIdx}, $${paramIdx + 1}))`);
      params.push('퇴사자', '휴직자');
      paramIdx += 2;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        u.*,
        CASE WHEN t.id IS NOT NULL THEN
          json_build_object('id', t.id, 'name', t.name)
        ELSE NULL END AS "Team"
      FROM "User" u
      LEFT JOIN "Team" t ON u."teamId" = t.id
      ${whereClause}
      ORDER BY u."createdAt" DESC
    `;

    return query<any>(sql, params);
  }

  async getUserById(id: string) {
    const sql = `
      SELECT
        u.*,
        CASE WHEN t.id IS NOT NULL THEN
          row_to_json(t)
        ELSE NULL END AS "Team"
      FROM "User" u
      LEFT JOIN "Team" t ON u."teamId" = t.id
      WHERE u.id = $1
    `;
    return queryOne<any>(sql, [id]);
  }

  async updateUser(
    id: string,
    data: {
      displayName?: string;
      email?: string;
      role?: UserRole;
      teamId?: string | null;
      isVerified?: boolean;
      isActive?: boolean;
    }
  ) {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (data.displayName !== undefined) {
      setClauses.push(`"displayName" = $${paramIdx++}`);
      params.push(data.displayName);
    }
    if (data.email !== undefined) {
      setClauses.push(`email = $${paramIdx++}`);
      params.push(data.email);
    }
    if (data.role !== undefined) {
      setClauses.push(`role = $${paramIdx++}`);
      params.push(data.role);
    }
    if (data.teamId !== undefined) {
      setClauses.push(`"teamId" = $${paramIdx++}`);
      params.push(data.teamId);
    }
    if (data.isVerified !== undefined) {
      setClauses.push(`"isVerified" = $${paramIdx++}`);
      params.push(data.isVerified);
    }
    if (data.isActive !== undefined) {
      setClauses.push(`"isActive" = $${paramIdx++}`);
      params.push(data.isActive);
    }

    setClauses.push(`"updatedAt" = $${paramIdx++}`);
    params.push(new Date());

    params.push(id);

    const sql = `
      UPDATE "User"
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIdx}
      RETURNING *
    `;

    const updated = await queryOne<any>(sql, params);
    if (!updated) return null;

    // Fetch Team relation
    const teamSql = `
      SELECT id, name, description FROM "Team" WHERE id = $1
    `;
    const team = updated.teamId ? await queryOne<any>(teamSql, [updated.teamId]) : null;
    return { ...updated, Team: team };
  }

  async verifyUser(id: string, role: UserRole = UserRole.MEMBER, teamId?: string) {
    const sql = `
      UPDATE "User"
      SET "isVerified" = true,
          role = $1,
          "teamId" = $2,
          "updatedAt" = $3
      WHERE id = $4
      RETURNING *
    `;
    const updated = await queryOne<any>(sql, [role, teamId ?? null, new Date(), id]);
    if (!updated) return null;

    const teamSql = `SELECT id, name, description FROM "Team" WHERE id = $1`;
    const team = updated.teamId ? await queryOne<any>(teamSql, [updated.teamId]) : null;
    return { ...updated, Team: team };
  }

  async deleteUser(id: string) {
    const sql = `DELETE FROM "User" WHERE id = $1 RETURNING *`;
    return queryOne<any>(sql, [id]);
  }

  async getPendingUsers() {
    const sql = `
      SELECT * FROM "User"
      WHERE "isVerified" = false
        AND "isActive" = true
        AND role != $1
      ORDER BY "createdAt" DESC
    `;
    return query<any>(sql, [UserRole.ADMIN]);
  }

  async assignToTeam(userId: string, teamId: string) {
    const sql = `
      UPDATE "User"
      SET "teamId" = $1,
          "updatedAt" = $2
      WHERE id = $3
      RETURNING *
    `;
    const updated = await queryOne<any>(sql, [teamId, new Date(), userId]);
    if (!updated) return null;

    const teamSql = `SELECT id, name, description FROM "Team" WHERE id = $1`;
    const team = updated.teamId ? await queryOne<any>(teamSql, [updated.teamId]) : null;
    return { ...updated, Team: team };
  }

  async removeFromTeam(userId: string) {
    const sql = `
      UPDATE "User"
      SET "teamId" = NULL,
          "updatedAt" = $1
      WHERE id = $2
      RETURNING *
    `;
    const updated = await queryOne<any>(sql, [new Date(), userId]);
    if (!updated) return null;
    return { ...updated, Team: null };
  }

  async getTeamMembers(teamId: string) {
    const sql = `
      SELECT * FROM "User"
      WHERE "teamId" = $1
        AND "isActive" = true
      ORDER BY role ASC, "displayName" ASC
    `;
    return query<any>(sql, [teamId]);
  }

  async getPendingApprovals() {
    const sql = `
      SELECT * FROM "User"
      WHERE "approvalRequested" = true
        AND "isVerified" = false
        AND "isActive" = true
        AND role != $1
      ORDER BY "approvalRequestedAt" DESC
    `;
    return query<any>(sql, [UserRole.ADMIN]);
  }

  async approveUser(id: string) {
    const sql = `
      UPDATE "User"
      SET "isVerified" = true,
          "approvalRequested" = false,
          "updatedAt" = $1
      WHERE id = $2
      RETURNING *
    `;
    const updated = await queryOne<any>(sql, [new Date(), id]);
    if (!updated) return null;

    const teamSql = `SELECT id, name, description FROM "Team" WHERE id = $1`;
    const team = updated.teamId ? await queryOne<any>(teamSql, [updated.teamId]) : null;
    return { ...updated, Team: team };
  }

  async rejectUser(id: string) {
    const sql = `
      UPDATE "User"
      SET "approvalRequested" = false,
          "approvalRequestedAt" = NULL,
          "approvalMessage" = NULL,
          "updatedAt" = $1
      WHERE id = $2
      RETURNING *
    `;
    return queryOne<any>(sql, [new Date(), id]);
  }
}

export default new UserService();
