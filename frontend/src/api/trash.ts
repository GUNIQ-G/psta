import axios from './axios';
import { Item } from '../types';

interface TrashItem extends Item {
  deletedAt: string;
  deletedById: string;
  DeletedBy?: {
    id: string;
    username: string;
    displayName: string;
  };
}

export const trashApi = {
  /**
   * 휴지통 항목 조회 (관리자 전용)
   */
  getTrashItems: async (params?: {
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<TrashItem[]> => {
    const response = await axios.get<TrashItem[]>('/trash', { params });
    return response.data;
  },

  /**
   * 항목 복원 (관리자 전용)
   */
  restoreItem: async (id: string): Promise<{ message: string; item: Item }> => {
    const response = await axios.post<{ message: string; item: Item }>(`/trash/${id}/restore`);
    return response.data;
  },

  /**
   * 항목 영구 삭제 (관리자 전용)
   */
  permanentlyDeleteItem: async (id: string): Promise<{ message: string }> => {
    const response = await axios.delete<{ message: string }>(`/trash/${id}`);
    return response.data;
  },
};
