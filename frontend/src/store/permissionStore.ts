import { create } from 'zustand';
import { PermissionsMap, UserRole } from '../types';
import { permissionApi } from '../api/permissions';

interface PermissionStore {
  role: UserRole | null;
  permissions: PermissionsMap | null;
  loading: boolean;
  fetchPermissions: () => Promise<void>;
  hasPermission: (resource: string, action: 'canView' | 'canCreate' | 'canUpdate' | 'canDelete') => boolean;
  clear: () => void;
}

export const usePermissionStore = create<PermissionStore>((set, get) => ({
  role: null,
  permissions: null,
  loading: false,

  fetchPermissions: async () => {
    set({ loading: true });
    try {
      const data = await permissionApi.getMyPermissions();
      set({ role: data.role, permissions: data.permissions, loading: false });
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      set({ loading: false });
    }
  },

  hasPermission: (resource: string, action: 'canView' | 'canCreate' | 'canUpdate' | 'canDelete') => {
    const { permissions } = get();
    if (!permissions) return false;
    const resourcePermissions = permissions[resource];
    if (!resourcePermissions) return false;
    return resourcePermissions[action];
  },

  clear: () => {
    set({ role: null, permissions: null, loading: false });
  },
}));
