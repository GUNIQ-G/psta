import axiosInstance from './axios';
import { User, UserRole } from '../types/user';

export const userApi = {
  getAll: async (includeInactive = false): Promise<User[]> => {
    const response = await axiosInstance.get('/users', {
      params: { includeInactive },
    });
    return response.data;
  },

  getById: async (id: string): Promise<User> => {
    const response = await axiosInstance.get(`/users/${id}`);
    return response.data;
  },

  getPending: async (): Promise<User[]> => {
    const response = await axiosInstance.get('/users/pending');
    return response.data;
  },

  update: async (
    id: string,
    data: {
      displayName?: string;
      email?: string;
      role?: UserRole;
      teamId?: string | null;
      isVerified?: boolean;
      isActive?: boolean;
    }
  ): Promise<User> => {
    const response = await axiosInstance.put(`/users/${id}`, data);
    return response.data;
  },

  verify: async (
    id: string,
    role: UserRole,
    teamId?: string
  ): Promise<User> => {
    const response = await axiosInstance.post(`/users/${id}/verify`, {
      role,
      teamId,
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/users/${id}`);
  },

  assignToTeam: async (id: string, teamId: string): Promise<User> => {
    const response = await axiosInstance.post(`/users/${id}/assign-team`, {
      teamId,
    });
    return response.data;
  },

  removeFromTeam: async (id: string): Promise<User> => {
    const response = await axiosInstance.post(`/users/${id}/remove-team`);
    return response.data;
  },

  getTeamMembers: async (teamId: string): Promise<User[]> => {
    const response = await axiosInstance.get(`/users/team/${teamId}/members`);
    return response.data;
  },

  syncFromLDAP: async (id: string): Promise<{ message: string; user: User }> => {
    const response = await axiosInstance.post(`/users/${id}/sync-ldap`);
    return response.data;
  },

  syncAllFromLDAP: async (): Promise<{ total: number; synced: number; errors: string[] }> => {
    const response = await axiosInstance.post('/users/sync-all-ldap');
    return response.data;
  },

  getUserManagers: async (
    userId: string,
    context?: 'service' | 'team' | 'project'
  ): Promise<Array<{
    id: string;
    username: string;
    displayName: string;
    email: string;
    role: UserRole;
    priority: number;
    reason: string;
  }>> => {
    const response = await axiosInstance.get(`/users/${userId}/managers`, {
      params: context ? { context } : undefined,
    });
    return response.data;
  },
};
