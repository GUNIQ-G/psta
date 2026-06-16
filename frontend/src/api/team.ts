import axiosInstance from './axios';
import { Team, LDAPSyncResult } from '../types/user';

export const teamApi = {
  getAll: async (): Promise<Team[]> => {
    const response = await axiosInstance.get('/org/teams');
    return response.data;
  },

  getById: async (id: string): Promise<Team> => {
    const response = await axiosInstance.get(`/org/teams/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    ldapDn?: string;
    description?: string;
  }): Promise<Team> => {
    const response = await axiosInstance.post('/org/teams', data);
    return response.data;
  },

  update: async (
    id: string,
    data: {
      name?: string;
      ldapDn?: string;
      description?: string;
      isActive?: boolean;
    }
  ): Promise<Team> => {
    const response = await axiosInstance.put(`/org/teams/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/org/teams/${id}`);
  },

  syncFromLDAP: async (): Promise<LDAPSyncResult> => {
    const response = await axiosInstance.post('/org/teams/sync-ldap');
    return response.data;
  },

  getTeamMembers: async (teamId: string): Promise<any[]> => {
    const response = await axiosInstance.get(`/org/teams/${teamId}/members`);
    return response.data;
  },

  getHierarchy: async (): Promise<any[]> => {
    const response = await axiosInstance.get('/org/teams/hierarchy');
    return response.data;
  },
};
