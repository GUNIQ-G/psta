import axios from './axios';

export interface SlackConfig {
  id: string;
  name: string;
  botToken: string;
  userToken?: string;
  signingSecret?: string;
  verificationToken?: string;
  appId?: string;
  clientId?: string;
  clientSecret?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TestConnectionResponse {
  success: boolean;
  workspace?: string;
  botUser?: string;
  userId?: string;
  error?: string;
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
  email?: string;
}

export interface SendMessageResponse {
  success: boolean;
  timestamp?: string;
  userId?: string;
}

export const slackConfigApi = {
  // CRUD operations
  getAll: () => axios.get<SlackConfig[]>('/slack-configs'),
  getById: (id: string) => axios.get<SlackConfig>(`/slack-configs/${id}`),
  create: (data: Partial<SlackConfig>) => axios.post<SlackConfig>('/slack-configs', data),
  update: (id: string, data: Partial<SlackConfig>) => axios.put<SlackConfig>(`/slack-configs/${id}`, data),
  delete: (id: string) => axios.delete(`/slack-configs/${id}`),

  // Test connection
  testConnection: (botToken: string) =>
    axios.post<TestConnectionResponse>('/slack-configs/test', { botToken }),

  // Slack API operations
  getUserByEmail: (email: string) =>
    axios.get<SlackUser>('/slack-configs/users/lookup', { params: { email } }),

  sendDirectMessage: (userId: string, message: string) =>
    axios.post<SendMessageResponse>('/slack-configs/messages/send', { userId, message }),

  sendDirectMessageByEmail: (email: string, message: string) =>
    axios.post<SendMessageResponse>('/slack-configs/messages/send-by-email', { email, message }),
};
