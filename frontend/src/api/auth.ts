import axios from './axios';
import { LoginRequest, LoginResponse, User } from '../types';

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await axios.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  me: async (): Promise<User> => {
    const response = await axios.get<User>('/auth/me');
    return response.data;
  },
};