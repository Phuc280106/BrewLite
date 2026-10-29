'use client';

import { create } from 'zustand';

export type AppView = 'menu' | 'orders' | 'barista';

interface ViewState {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  currentView: 'menu',
  setCurrentView: (view: AppView) => set({ currentView: view }),
}));
