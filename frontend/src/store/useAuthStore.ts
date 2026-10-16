'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { UserProfile } from '../types';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  authNotice: string | null;
  setAuth: (user: UserProfile, token: string) => void;
  logout: () => void;
  openAuthModal: (tab?: 'login' | 'register', notice?: string) => void;
  closeAuthModal: () => void;
  setAuthModalTab: (tab: 'login' | 'register') => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthModalOpen: false,
      authModalTab: 'login',
      authNotice: null,

      setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('brewlite_token', token);
        }
        set({
          user,
          token,
          isAuthModalOpen: false,
          authNotice: null,
        });
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('brewlite_token');
        }
        set({
          user: null,
          token: null,
          isAuthModalOpen: false,
          authNotice: null,
        });
      },

      openAuthModal: (tab = 'login', notice) =>
        set({
          isAuthModalOpen: true,
          authModalTab: tab,
          authNotice: notice ?? null,
        }),

      closeAuthModal: () =>
        set({
          isAuthModalOpen: false,
          authNotice: null,
        }),

      setAuthModalTab: (tab) =>
        set({
          authModalTab: tab,
          authNotice: null,
        }),
    }),
    {
      name: 'brewlite_auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
