import axios from './axios';

export type NotificationAppType = 'SLACK' | 'TELEGRAM' | 'DISCORD' | 'LINE' | 'KAKAOTALK';

export interface NotificationApp {
  id: string;
  name: string;
  type: NotificationAppType;
  config: string; // JSON string
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TestConnectionResponse {
  success: boolean;
  platform?: string;
  workspace?: string;
  botUser?: string;
  botUsername?: string;
  botName?: string;
  userId?: string;
  method?: string;
  error?: string;
}

export interface SendMessageResponse {
  success: boolean;
  platform?: string;
  userId?: string;
  timestamp?: string;
}

export const notificationAppApi = {
  // CRUD operations
  getAll: () => axios.get<NotificationApp[]>('/notifications/apps'),
  getById: (id: string) => axios.get<NotificationApp>(`/notifications/apps/${id}`),
  create: (data: Partial<NotificationApp>) => axios.post<NotificationApp>('/notifications/apps', data),
  update: (id: string, data: Partial<NotificationApp>) => axios.put<NotificationApp>(`/notifications/apps/${id}`, data),
  delete: (id: string) => axios.delete(`/notifications/apps/${id}`),

  // Test connection
  testConnection: (type: NotificationAppType, config: string | object) =>
    axios.post<TestConnectionResponse>('/notifications/apps/test', { type, config }),

  // Send message
  sendMessageByEmail: (email: string, message: string, type?: NotificationAppType) =>
    axios.post<SendMessageResponse>('/notifications/apps/messages/send-by-email', { email, message, type }),
};

// Platform display names
export const PLATFORM_NAMES: Record<NotificationAppType, string> = {
  SLACK: 'Slack',
  TELEGRAM: 'Telegram',
  DISCORD: 'Discord',
  LINE: 'LINE',
  KAKAOTALK: '카카오톡',
};

// Platform icons (emoji)
export const PLATFORM_ICONS: Record<NotificationAppType, string> = {
  SLACK: '💬',
  TELEGRAM: '✈️',
  DISCORD: '🎮',
  LINE: '💚',
  KAKAOTALK: '💛',
};
