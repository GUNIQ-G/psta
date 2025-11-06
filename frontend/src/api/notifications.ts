import axios from './axios';
import { Notification } from '../types';

export const notificationsApi = {
  getMyNotifications: async (unreadOnly = false): Promise<Notification[]> => {
    const response = await axios.get<Notification[]>('/notifications', {
      params: { unreadOnly },
    });
    return response.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await axios.get<{ count: number }>('/notifications/unread-count');
    return response.data.count;
  },

  markAsRead: async (id: string): Promise<void> => {
    await axios.put(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await axios.put('/notifications/read-all');
  },
};
