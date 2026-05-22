import { create } from 'zustand';
import type { Profile } from './types';
import { mockCurrentUser } from './mock-data';

interface AppState {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  setUser: (user: { id: string; email: string } | null) => void;
  setProfile: (profile: Profile | null) => void;
  initMockData: () => void;

  notificationsVersion: number;
  refreshNotifications: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  profile: null,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  initMockData: () => {
    set({
      user: { id: 'current_user', email: 'test@example.com' },
      profile: mockCurrentUser,
    });
  },

  notificationsVersion: 0,
  refreshNotifications: () =>
    set((state) => ({ notificationsVersion: state.notificationsVersion + 1 })),
}));
