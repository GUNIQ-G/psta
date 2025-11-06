import { create } from 'zustand';
import { User } from '../types';
import { authApi } from '../api/auth';
import { usePermissionStore } from './permissionStore';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  // If token exists, set loading to true until fetchUser completes
  isLoading: !!localStorage.getItem('token'),

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login({ username, password });
      localStorage.setItem('token', response.token);
      set({ user: response.user, token: response.token, isLoading: false });
      // Fetch permissions after successful login
      await usePermissionStore.getState().fetchPermissions();
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
    // Clear permissions on logout
    usePermissionStore.getState().clear();
  },

  fetchUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ user: null, token: null, isLoading: false });
      return;
    }

    try {
      const user = await authApi.me();
      set({ user, token, isLoading: false });
      // Fetch permissions after fetching user
      await usePermissionStore.getState().fetchPermissions();
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
      usePermissionStore.getState().clear();
    }
  },
}));