import axios from './axios';
import { FileAttachment } from '../types';

export const filesApi = {
  // Upload file
  uploadFile: async (itemId: string, file: File): Promise<FileAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('itemId', itemId);

    const response = await axios.post('/assets/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get files for an item
  getItemFiles: async (itemId: string): Promise<FileAttachment[]> => {
    const response = await axios.get(`/assets/files/item/${itemId}`);
    return response.data;
  },

  // Get all files
  getAllFiles: async (): Promise<FileAttachment[]> => {
    const response = await axios.get('/assets/files');
    return response.data;
  },

  // Get hierarchical documents (files + links) for an item and its descendants
  getHierarchicalDocuments: async (itemId: string): Promise<{ files: FileAttachment[], links: any[] }> => {
    const response = await axios.get(`/assets/files/hierarchical/${itemId}`);
    return response.data;
  },

  // Delete file
  deleteFile: async (fileId: string): Promise<void> => {
    await axios.delete(`/assets/files/${fileId}`);
  },

  // Get file URL
  getFileUrl: (filename: string): string => {
    return `/uploads/item-files/${filename}`;
  },
};
