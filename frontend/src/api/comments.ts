import axios from './axios';
import { Comment } from '../types';

export const commentsApi = {
  getCommentsByItem: async (itemId: string): Promise<Comment[]> => {
    const response = await axios.get<Comment[]>(`/boards/comments/item/${itemId}`);
    return response.data;
  },

  createComment: async (itemId: string, content: string): Promise<Comment> => {
    const response = await axios.post<Comment>(`/boards/comments/item/${itemId}`, { content });
    return response.data;
  },

  deleteComment: async (id: string): Promise<void> => {
    await axios.delete(`/boards/comments/${id}`);
  },

  toggleReaction: async (commentId: string, emoji: string): Promise<Comment> => {
    const response = await axios.post<Comment>(`/boards/comments/${commentId}/reaction`, { emoji });
    return response.data;
  },
};
