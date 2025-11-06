import axios from './axios';
import { Link } from '../types';

export const linksApi = {
  // Create link
  createLink: async (itemId: string, url: string, displayName: string): Promise<Link> => {
    const response = await axios.post('/links', {
      itemId,
      url,
      displayName,
    });
    return response.data;
  },

  // Get links for an item
  getItemLinks: async (itemId: string): Promise<Link[]> => {
    const response = await axios.get(`/links/item/${itemId}`);
    return response.data;
  },

  // Get all links
  getAllLinks: async (): Promise<Link[]> => {
    const response = await axios.get('/links');
    return response.data;
  },

  // Delete link
  deleteLink: async (linkId: string): Promise<void> => {
    await axios.delete(`/links/${linkId}`);
  },
};
