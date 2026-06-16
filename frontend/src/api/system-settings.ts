import axios from './axios';

export interface SystemSettings {
  systemName?: string;
  systemDescription?: string;
  adminEmail?: string;
  systemLogo?: string;
  favicon?: string;
  copyrightText?: string;
  frontendUrl?: string;
}

export const systemSettingsApi = {
  // Get all system settings
  getSettings: async (): Promise<SystemSettings> => {
    const response = await axios.get('/settings/system');
    return response.data;
  },

  // Get a specific setting by key
  getSetting: async (key: string): Promise<{ key: string; value: string }> => {
    const response = await axios.get(`/settings/system/${key}`);
    return response.data;
  },

  // Update a specific setting
  updateSetting: async (key: string, value: string): Promise<void> => {
    await axios.put(`/settings/system/${key}`, { value });
  },

  // Update multiple settings at once
  updateSettings: async (settings: SystemSettings): Promise<void> => {
    await axios.put('/settings/system', settings);
  },

  // Upload system logo
  uploadLogo: async (file: File): Promise<{ logoUrl: string }> => {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await axios.post('/settings/system/upload-logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Delete system logo
  deleteLogo: async (): Promise<void> => {
    await axios.delete('/settings/system/logo');
  },

  // Upload favicon
  uploadFavicon: async (file: File): Promise<{ faviconUrl: string }> => {
    const formData = new FormData();
    formData.append('favicon', file);

    const response = await axios.post('/settings/system/upload-favicon', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Delete favicon
  deleteFavicon: async (): Promise<void> => {
    await axios.delete('/settings/system/favicon');
  },
};
