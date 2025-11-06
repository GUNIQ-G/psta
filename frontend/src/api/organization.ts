import axios from './axios';

export interface Organization {
  id: string;
  name: string;
  type: 'COMPANY' | 'DIVISION' | 'DEPARTMENT' | 'TEAM';
  description?: string;
  ldapDn?: string;
  parentId?: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  Members?: Array<{
    id: string;
    username: string;
    displayName: string;
    email: string;
    role: string;
  }>;
  Parent?: {
    id: string;
    name: string;
    type: string;
  };
  Children?: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  children?: Organization[];
  _count?: {
    Children: number;
    Members: number;
  };
}

export const organizationApi = {
  getTree: () => axios.get<Organization[]>('/organizations/tree'),

  getById: (id: string) => axios.get<Organization>(`/organizations/${id}`),

  create: (data: {
    name: string;
    type: string;
    description?: string;
    parentId?: string;
    ldapDn?: string;
  }) => axios.post<Organization>('/organizations', data),

  update: (id: string, data: {
    name?: string;
    type?: string;
    description?: string;
    parentId?: string;
    ldapDn?: string;
    isActive?: boolean;
    order?: number;
  }) => axios.put<Organization>(`/organizations/${id}`, data),

  delete: (id: string) => axios.delete(`/organizations/${id}`),

  addMember: (organizationId: string, userId: string) =>
    axios.post('/organizations/add-member', { organizationId, userId }),

  removeMember: (userId: string) =>
    axios.post('/organizations/remove-member', { userId }),

  syncFromLdap: () => axios.post<{ message: string; stats: { total: number; created: number; updated: number; skipped: number; } }>('/organizations/sync-from-ldap'),
};
