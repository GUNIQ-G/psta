import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import ldapService from '../config/ldap';

const prisma = new PrismaClient();

class TeamService {
  async getAllTeams() {
    return prisma.team.findMany({
      where: { isActive: true },
      include: {
        User: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
            title: true,
            position: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get hierarchical team structure
   * v1.1.18: Returns teams organized in parent-child hierarchy
   */
  async getTeamHierarchy() {
    // Fetch all active teams with their users
    const allTeams = await prisma.team.findMany({
      where: { isActive: true },
      include: {
        User: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            phoneNumber: true,
            role: true,
            title: true,
            position: true,
            departmentNumber: true,
          },
          orderBy: [
            { position: 'asc' },
            { title: 'asc' },
            { displayName: 'asc' },
          ],
        },
      },
      orderBy: [
        { level: 'asc' },
        { name: 'asc' },
      ],
    });

    // Build hierarchy: group teams by parent
    const teamMap = new Map<string, any>();
    const rootTeams: any[] = [];

    // First pass: create map of all teams
    allTeams.forEach(team => {
      teamMap.set(team.id, {
        ...team,
        children: [],
      });
    });

    // Second pass: build hierarchy
    allTeams.forEach(team => {
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
    return prisma.team.findUnique({
      where: { id },
      include: {
        User: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            role: true,
            isVerified: true,
            isActive: true,
          },
        },
      },
    });
  }

  async createTeam(data: {
    name: string;
    ldapDn?: string;
    description?: string;
  }) {
    return prisma.team.create({
      data: {
        id: randomUUID(),
        name: data.name,
        ldapDn: data.ldapDn,
        description: data.description,
        updatedAt: new Date(),
      },
    });
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
    return prisma.team.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async deleteTeam(id: string) {
    // 먼저 해당 팀의 사용자들을 팀에서 제거
    await prisma.user.updateMany({
      where: { teamId: id },
      data: { teamId: null, updatedAt: new Date() },
    });

    return prisma.team.delete({
      where: { id },
    });
  }

  async getTeamMembers(teamId: string) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        User: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            role: true,
            isActive: true,
            isVerified: true,
          },
          where: {
            isActive: true,
            isVerified: true,
          },
        },
      },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    return team.User;
  }

  /**
   * Reset all teams (delete all teams and clear user team assignments)
   * v1.1.19: Organization initialization feature
   */
  async resetAllTeams() {
    // Start a transaction to ensure data consistency
    return prisma.$transaction(async (tx) => {
      // 1. Count teams before deletion
      const teamCount = await tx.team.count();
      const userCount = await tx.user.count({ where: { teamId: { not: null } } });

      // 2. Clear all user team assignments
      await tx.user.updateMany({
        where: { teamId: { not: null } },
        data: {
          teamId: null,
          organizationId: null,
          updatedAt: new Date()
        },
      });

      // 3. Delete all teams
      await tx.team.deleteMany({});

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

          const existing = await prisma.team.findFirst({
            where: { ldapDn: groupDn },
          });

          if (existing) {
            // Only update if there are actual changes
            if (existing.name !== group.name || existing.description !== groupDescription) {
              await prisma.team.update({
                where: { id: existing.id },
                data: {
                  name: group.name,
                  description: groupDescription,
                  updatedAt: new Date(),
                },
              });
              results.updated++;
            }
            // If no changes, don't count as updated
          } else {
            await prisma.team.create({
              data: {
                id: randomUUID(),
                name: group.name,
                ldapDn: groupDn,
                description: groupDescription,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
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
