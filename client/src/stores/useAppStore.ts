import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppStore {
  // Dark mode
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Quick search
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // Current user (MVP: không có auth, chỉ lưu tên)
  currentUser: string;
  setCurrentUser: (name: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      darkMode: false,
      toggleDarkMode: () => set((state) => {
        const next = !state.darkMode;
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { darkMode: next };
      }),

      searchOpen: false,
      setSearchOpen: (open) => set({ searchOpen: open }),

      currentUser: 'Product Manager',
      setCurrentUser: (name) => set({ currentUser: name }),
    }),
    {
      name: 'rd-app-store',
      onRehydrateStorage: () => (state) => {
        // Áp dụng dark mode khi load lại trang
        if (state?.darkMode) {
          document.documentElement.classList.add('dark');
        }
      },
    }
  )
);
