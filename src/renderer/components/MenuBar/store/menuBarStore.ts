import { create } from 'zustand';

interface MenuBarState {
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  closeMenu: () => void;
}

export const useMenuBarStore = create<MenuBarState>((set) => ({
  openMenuId: null,
  setOpenMenuId: (id) => set({ openMenuId: id }),
  closeMenu: () => set({ openMenuId: null }),
}));
