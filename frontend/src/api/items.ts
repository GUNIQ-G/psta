import axios from './axios';
import { Item } from '../types';

export const itemsApi = {
  getItems: async (params?: {
    clientId?: string;
    type?: string;
    parentId?: string | null;
    assigneeId?: string;
  }): Promise<Item[]> => {
    const response = await axios.get<Item[]>('/items', { params });
    return response.data;
  },

  getItemTree: async (clientId?: string, userTeamId?: string): Promise<Item[]> => {
    const response = await axios.get<Item[]>('/items/tree', {
      params: { clientId, userTeamId, _t: Date.now() }, // Cache buster
    });
    return response.data;
  },

  getItemById: async (id: string): Promise<Item> => {
    const response = await axios.get<Item>(`/items/${id}`);
    return response.data;
  },

  createItem: async (data: Partial<Item>): Promise<Item> => {
    const response = await axios.post<Item>('/items', data);
    return response.data;
  },

  updateItem: async (id: string, data: Partial<Item>): Promise<Item> => {
    const response = await axios.put<Item>(`/items/${id}`, data);
    return response.data;
  },

  moveItem: async (id: string, parentId?: string, serviceTeamId?: string): Promise<Item> => {
    const response = await axios.patch<Item>(`/items/${id}/move`, { parentId, serviceTeamId });
    return response.data;
  },

  deleteItem: async (id: string): Promise<any> => {
    const response = await axios.delete(`/items/${id}`);
    return response.data;
  },
};