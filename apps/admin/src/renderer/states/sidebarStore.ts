import { create } from 'zustand';

const SIDEBAR_COLLAPSED_KEY = 'admin.sidebarCollapsed';

interface SidebarState {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

export const useSidebarStore = create<SidebarState>()((set, get) => ({
  collapsed: localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',

  toggleCollapsed: () => {
    const next = !get().collapsed;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    set({ collapsed: next });
  },
}));
