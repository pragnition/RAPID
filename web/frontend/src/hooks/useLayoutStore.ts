import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SidebarState } from "@/types/layout";

const CYCLE_FORWARD: Record<SidebarState, SidebarState> = {
  full: "compact",
  compact: "hidden",
  hidden: "full",
};

const CYCLE_BACK: Record<SidebarState, SidebarState> = {
  full: "hidden",
  hidden: "compact",
  compact: "full",
};

interface LayoutState {
  sidebarState: SidebarState;
  isMobileDrawerOpen: boolean;
  cycleSidebarForward: () => void;
  cycleSidebarBack: () => void;
  setSidebarState: (state: SidebarState) => void;
  toggleMobileDrawer: () => void;
  closeMobileDrawer: () => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarState: "full",
      isMobileDrawerOpen: false,

      cycleSidebarForward: () =>
        set((s) => ({ sidebarState: CYCLE_FORWARD[s.sidebarState] })),

      cycleSidebarBack: () =>
        set((s) => ({ sidebarState: CYCLE_BACK[s.sidebarState] })),

      setSidebarState: (sidebarState) => set({ sidebarState }),

      toggleMobileDrawer: () =>
        set((s) => ({ isMobileDrawerOpen: !s.isMobileDrawerOpen })),

      closeMobileDrawer: () => set({ isMobileDrawerOpen: false }),
    }),
    {
      name: "rapid-sidebar",
      partialize: (state) => ({ sidebarState: state.sidebarState }),
    },
  ),
);
