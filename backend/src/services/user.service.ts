import { PrismaClient, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

class UserService {
  async getAllUsers(includeInactive = false) {
    return prisma.user.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        role: { not: UserRole.ADMIN },
      },
      include: {
        Team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        Team: true,
      },
    });
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
    return prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        Team: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
  }

  async verifyUser(id: string, role: UserRole = UserRole.MEMBER, teamId?: string) {
    return prisma.user.update({
      where: { id },
      data: {
        isVerified: true,
        role,
        teamId,
        updatedAt: new Date(),
      },
      include: {
        Team: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
  }

  async deleteUser(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }

  async getPendingUsers() {
    return prisma.user.findMany({
      where: {
        isVerified: false,
        isActive: true,
        role: { not: UserRole.ADMIN },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignToTeam(userId: string, teamId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        teamId,
        updatedAt: new Date(),
      },
      include: {
        Team: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
  }

  async removeFromTeam(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        teamId: null,
        updatedAt: new Date(),
      },
      include: {
        Team: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
  }

  async getTeamMembers(teamId: string) {
    return prisma.user.findMany({
      where: {
        teamId,
        isActive: true,
      },
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
    });
  }

  async getPendingApprovals() {
    return prisma.user.findMany({
      where: {
        approvalRequested: true,
        isVerified: false,
        isActive: true,
        role: { not: UserRole.ADMIN },
      },
      orderBy: { approvalRequestedAt: 'desc' },
    });
  }

  async approveUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        isVerified: true,
        approvalRequested: false,
        updatedAt: new Date(),
      },
      include: {
        Team: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
  }

  async rejectUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        approvalRequested: false,
        approvalRequestedAt: null,
        approvalMessage: null,
        updatedAt: new Date(),
      },
    });
  }
}

export default new UserService();
