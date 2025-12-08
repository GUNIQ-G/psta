import { create } from 'zustand';
import { Message } from '../types';
import { messagesApi } from '../api/messages';

interface MessageState {
  receivedMessages: Message[];
  sentMessages: Message[];
  unreadCount: number;
  isLoading: boolean;
  fetchReceivedMessages: (unreadOnly?: boolean) => Promise<void>;
  fetchSentMessages: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  sendMessage: (data: { toUserId: string; subject: string; content: string }) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export const useMessageStore = create<MessageState>((set, get) => ({
  receivedMessages: [],
  sentMessages: [],
  unreadCount: 0,
  isLoading: false,

  fetchReceivedMessages: async (unreadOnly = false) => {
    set({ isLoading: true });
    try {
      const messages = await messagesApi.getReceivedMessages(unreadOnly);
      set({ receivedMessages: messages, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch received messages:', error);
      set({ isLoading: false });
    }
  },

  fetchSentMessages: async () => {
    set({ isLoading: true });
    try {
      const messages = await messagesApi.getSentMessages();
      set({ sentMessages: messages, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch sent messages:', error);
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const count = await messagesApi.getUnreadCount();
      set({ unreadCount: count });
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  },

  sendMessage: async (data) => {
    try {
      await messagesApi.sendMessage(data);
      // 보낸 메시지 목록 갱신
      get().fetchSentMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  },

  markAsRead: async (id: string) => {
    try {
      await messagesApi.markAsRead(id);
      // 로컬 상태 업데이트
      set((state) => ({
        receivedMessages: state.receivedMessages.map((m) =>
          m.id === id ? { ...m, isRead: true } : m
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  },

  deleteMessage: async (id: string) => {
    try {
      await messagesApi.deleteMessage(id);
      // 로컬 상태에서 제거
      set((state) => ({
        receivedMessages: state.receivedMessages.filter((m) => m.id !== id),
        sentMessages: state.sentMessages.filter((m) => m.id !== id),
      }));
      // 읽지 않은 개수 갱신
      get().fetchUnreadCount();
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  },

  startPolling: () => {
    // Fetch immediately
    get().fetchUnreadCount();

    // Poll every 30 seconds
    if (!pollingInterval) {
      pollingInterval = setInterval(() => {
        get().fetchUnreadCount();
      }, 30000);
    }
  },

  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  },
}));
