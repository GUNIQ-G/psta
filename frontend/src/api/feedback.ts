import { api } from './axios';

export enum FeedbackType {
  BUG = 'BUG',
  FEATURE = 'FEATURE',
  IMPROVEMENT = 'IMPROVEMENT',
}

export enum FeedbackStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export interface Feedback {
  id: string;
  title: string;
  content: string;
  type: FeedbackType;
  status: FeedbackStatus;
  adminComment?: string;
  createdById: string;
  resolvedAt?: string;
  resolvedById?: string;
  createdAt: string;
  updatedAt: string;
  CreatedBy: {
    id: string;
    displayName: string;
    username: string;
    Team?: {
      id: string;
      name: string;
    };
  };
  ResolvedBy?: {
    id: string;
    displayName: string;
  };
}

export interface FeedbackListResponse {
  data: Feedback[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FeedbackStats {
  total: number;
  byStatus: {
    pending: number;
    inProgress: number;
    resolved: number;
    rejected: number;
  };
  byType: {
    BUG: number;
    FEATURE: number;
    IMPROVEMENT: number;
  };
}

export const feedbackApi = {
  // Get all feedbacks with filtering
  getAll: async (params?: {
    type?: FeedbackType | 'ALL';
    status?: FeedbackStatus | 'ALL';
    page?: number;
    limit?: number;
  }): Promise<FeedbackListResponse> => {
    const response = await api.get('/feedbacks', { params });
    return response.data;
  },

  // Get feedback by ID
  getById: async (id: string): Promise<Feedback> => {
    const response = await api.get(`/feedbacks/${id}`);
    return response.data;
  },

  // Create new feedback
  create: async (data: {
    title: string;
    content: string;
    type: FeedbackType;
  }): Promise<Feedback> => {
    const response = await api.post('/feedbacks', data);
    return response.data;
  },

  // Update feedback
  update: async (
    id: string,
    data: {
      title?: string;
      content?: string;
      status?: FeedbackStatus;
      adminComment?: string;
    }
  ): Promise<Feedback> => {
    const response = await api.put(`/feedbacks/${id}`, data);
    return response.data;
  },

  // Delete feedback
  delete: async (id: string): Promise<void> => {
    await api.delete(`/feedbacks/${id}`);
  },

  // Get feedback statistics
  getStats: async (): Promise<FeedbackStats> => {
    const response = await api.get('/feedbacks/stats');
    return response.data;
  },
};
