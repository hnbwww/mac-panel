import { create } from 'zustand';
import { API_BASE_URL } from '../config';

interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; username: string } | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!localStorage.getItem('token'),
  user: null,
  token: localStorage.getItem('token'),

  login: async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    set({ isAuthenticated: true, user: data.user, token: data.token });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ isAuthenticated: false, user: null, token: null });
  },

  setToken: (token: string) => {
    localStorage.setItem('token', token);
    set({ token, isAuthenticated: true });
  },
}));

interface FileState {
  currentPath: string;
  selectedFiles: string[];
  setCurrentPath: (path: string) => void;
  setSelectedFiles: (files: string[]) => void;
}

export const useFileStore = create<FileState>((set) => ({
  currentPath: '/',
  selectedFiles: [],
  setCurrentPath: (path) => set({ currentPath: path }),
  setSelectedFiles: (files) => set({ selectedFiles: files }),
}));

interface TerminalState {
  activeTab: string;
  tabs: { id: string; title: string }[];
  addTab: (tab: { id: string; title: string }) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  activeTab: '1',
  tabs: [{ id: '1', title: 'Terminal 1' }],

  addTab: (tab) => set((state) => ({ tabs: [...state.tabs, tab] })),

  removeTab: (id) => set((state) => ({
    tabs: state.tabs.filter((t) => t.id !== id),
    activeTab: state.activeTab === id ? state.tabs[0]?.id || '' : state.activeTab,
  })),

  setActiveTab: (id) => set({ activeTab: id }),
}));
