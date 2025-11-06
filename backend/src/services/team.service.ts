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
          },
        },
      },
      orderBy: { name: 'asc' },
    });
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
