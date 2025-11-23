import { create } from 'zustand';
import { authAPI } from '@/services/api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  sessionId: localStorage.getItem('sessionId'),
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (email: string, password: string) => {
    const response = await authAPI.login({ email, password });
    const { user, accessToken, sessionId } = response.data;
    localStorage.setItem('token', accessToken);
    localStorage.setItem('sessionId', sessionId);
    set({ user, token: accessToken, sessionId, isAuthenticated: true });
  },

  register: async (email: string, password: string, name: string) => {
    const response = await authAPI.register({ email, password, name });
    const { user, accessToken, sessionId } = response.data;
    localStorage.setItem('token', accessToken);
    localStorage.setItem('sessionId', sessionId);
    set({ user, token: accessToken, sessionId, isAuthenticated: true });
  },

  logout: async () => {
    const { sessionId } = get();

    // Call logout API to invalidate session on server
    try {
      if (sessionId) {
        await authAPI.logout(sessionId);
      }
    } catch (error) {
      // Continue logout even if API call fails
      console.error('Logout API error:', error);
    }

    // Clear local storage and state
    localStorage.removeItem('token');
    localStorage.removeItem('sessionId');
    set({ user: null, token: null, sessionId: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const response = await authAPI.getProfile();
      set({ user: response.data, isAuthenticated: true });
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
}));
