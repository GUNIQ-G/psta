import axiosInstance from './axios';

export interface SyncResult {
  success: boolean;
  timestamp: string;
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

export interface SyncStats {
  lastSync: string | null;
  lastSyncSuccess: boolean;
  ldapGroups: number;
  ldapUsers: number;
  pstaTeams: number;
  pstaActiveUsers: number;
  pstaInactiveUsers: number;
}

export const ldapSyncApi = {
  /**
   * Trigger manual LDAP sync
   */
  triggerSync: async (dryRun: boolean = false): Promise<{ success: boolean; result: SyncResult }> => {
    const response = await axiosInstance.post('/ldap-sync/sync', { dryRun });
    return response.data;
  },

  /**
   * Get last sync result
   */
  getLastSyncResult: async (): Promise<{ success: boolean; result: SyncResult | null }> => {
    const response = await axiosInstance.get('/ldap-sync/last-result');
    return response.data;
  },

  /**
   * Get sync statistics
   */
  getSyncStats: async (): Promise<{ success: boolean; stats: SyncStats }> => {
    const response = await axiosInstance.get('/ldap-sync/stats');
    return response.data;
  },
};
