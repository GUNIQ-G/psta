import axios from './axios';
import { Permission, PermissionsMap, UserRole } from '../types';

export interface MyPermissionsResponse {
  role: UserRole;
  permissions: PermissionsMap;
}

export const permissionApi = {
  // Get current user's permissions
  getMyPermissions: async (): Promise<MyPermissionsResponse> => {
    const response = await axios.get<MyPermissionsResponse>('/permissions/my');
    return response.data;
  },

  // Get all permissions (admin only)
  getAllPermissions: async (): Promise<Permission[]> => {
    const response = await axios.get<Permission[]>('/permissions');
    return response.data;
  },

  // Get permissions by role
  getPermissionsByRole: async (role: UserRole): Promise<Permission[]> => {
    const response = await axios.get<Permission[]>(`/permissions/role/${role}`);
    return response.data;
  },

  // Update single permission
  updatePermission: async (
    id: string,
    data: {
      canView?: boolean;
      canCreate?: boolean;
      canUpdate?: boolean;
      canDelete?: boolean;
    }
  ): Promise<Permission> => {
    const response = await axios.put<Permission>(`/permissions/${id}`, data);
    return response.data;
  },

  // Bulk update permissions for a role
  updateRolePermissions: async (
    role: UserRole,
    permissions: Array<{
      resource: string;
      canView: boolean;
      canCreate: boolean;
      canUpdate: boolean;
      canDelete: boolean;
    }>
  ): Promise<{ updated: number }> => {
    const response = await axios.put<{ updated: number }>(
      `/permissions/role/${role}/bulk`,
      { permissions }
    );
    return response.data;
  },
};
