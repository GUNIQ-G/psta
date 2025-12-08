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

export interface LdapUserPreview {
  uid: string;
  cn: string;
  displayName: string;
  mail: string;
  dn: string;
  groups: string[];
  existsInPsta: boolean;
  pstaStatus: 'active' | 'inactive' | 'not_found';
  pstaTeam: string | null;
}

// v1.1.19: Hierarchical tree node type
export interface LdapTreeNode {
  key: string;
  title: string;
  type: 'organization' | 'user';
  dn: string;
  children?: LdapTreeNode[];
  // Organization info
  description?: string;
  // User info
  uid?: string;
  email?: string;
  userTitle?: string;
  department?: string;
  pstaStatus?: 'active' | 'inactive' | 'not_found';
  pstaTeam?: string | null;
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

  /**
   * Preview LDAP users before sync
   */
  previewLdapUsers: async (): Promise<{ success: boolean; ldapUsers: LdapUserPreview[]; totalCount: number }> => {
    const response = await axiosInstance.get('/ldap-sync/preview');
    return response.data;
  },

  /**
   * Selective sync - sync only selected users
   */
  selectiveSync: async (selectedUserDns: string[], dryRun: boolean = false): Promise<{ success: boolean; result: SyncResult }> => {
    const response = await axiosInstance.post('/ldap-sync/selective', {
      selectedUserDns,
      dryRun,
    });
    return response.data;
  },

  /**
   * v1.1.19: Preview hierarchical LDAP structure
   */
  previewHierarchicalLdap: async (): Promise<{
    success: boolean;
    tree: LdapTreeNode[];
    totalOrgs: number;
    totalUsers: number;
  }> => {
    const response = await axiosInstance.get('/ldap-sync/preview-hierarchical');
    return response.data;
  },

  /**
   * v1.1.19: Apply selected LDAP items (organizations and users)
   */
  applySelectedLdapItems: async (selectedKeys: string[], dryRun: boolean = false): Promise<{ success: boolean; result: SyncResult }> => {
    const response = await axiosInstance.post('/ldap-sync/apply', {
      selectedKeys,
      dryRun,
    });
    return response.data;
  },
};
