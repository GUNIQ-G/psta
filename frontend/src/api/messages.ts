import api from './axios';
import { Message } from '../types';

export const messagesApi = {
  // 받은 메시지 목록 조회
  getReceivedMessages: async (unreadOnly = false): Promise<Message[]> => {
    const response = await api.get('/notifications/messages/received', {
      params: { unreadOnly },
    });
    return response.data;
  },

  // 보낸 메시지 목록 조회
  getSentMessages: async (): Promise<Message[]> => {
    const response = await api.get('/notifications/messages/sent');
    return response.data;
  },

  // 메시지 상세 조회
  getMessageById: async (id: string): Promise<Message> => {
    const response = await api.get(`/notifications/messages/${id}`);
    return response.data;
  },

  // 메시지 전송
  sendMessage: async (data: {
    toUserId: string;
    subject: string;
    content: string;
  }): Promise<Message> => {
    const response = await api.post('/notifications/messages', data);
    return response.data;
  },

  // 읽지 않은 메시지 개수 조회
  getUnreadCount: async (): Promise<number> => {
    const response = await api.get<{ count: number }>('/notifications/messages/unread-count');
    return response.data.count;
  },

  // 메시지 읽음 처리
  markAsRead: async (id: string): Promise<void> => {
    await api.put(`/notifications/messages/${id}/read`);
  },

  // 메시지 삭제
  deleteMessage: async (id: string): Promise<void> => {
    await api.delete(`/notifications/messages/${id}`);
  },
};
