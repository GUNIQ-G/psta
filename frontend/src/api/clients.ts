import axios from './axios';
import { Client } from '../types';

export const clientsApi = {
  getClients: async (): Promise<Client[]> => {
    const response = await axios.get<Client[]>('/clients');
    return response.data;
  },

  createClient: async (data: { name: string; code: string }): Promise<Client> => {
    const response = await axios.post<Client>('/clients', data);
    return response.data;
  },

  updateClient: async (id: string, data: Partial<Client>): Promise<Client> => {
    const response = await axios.put<Client>(`/clients/${id}`, data);
    return response.data;
  },

  deleteClient: async (id: string): Promise<void> => {
    await axios.delete(`/clients/${id}`);
  },

  uploadLogo: async (file: File): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await axios.post<{ url: string; filename: string }>(
      '/clients/upload-logo',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },
};