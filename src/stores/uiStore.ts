/**
 * UI Preferences Store
 * Manages UI state like sidebar visibility, preferences, etc.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Theme preferences (for future use)
  compactMode: boolean;
  setCompactMode: (compact: boolean) => void;

  // Panel visibility
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar - default expanded
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Compact mode
      compactMode: false,
      setCompactMode: (compact) => set({ compactMode: compact }),

      // Right panel
      rightPanelOpen: false,
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
    }),
    {
      name: 'buildit-ui-preferences',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        compactMode: state.compactMode,
      }),
    }
  )
);

export default useUIStore;
