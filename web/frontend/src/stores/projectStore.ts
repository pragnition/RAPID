import { create } from "zustand";

const STORAGE_KEY = "rapid-active-project";

interface ProjectStore {
  activeProjectId: string | null;
  setActiveProject: (id: string | null) => void;
}

function readStoredProjectId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export const useProjectStore = create<ProjectStore>((set) => ({
  activeProjectId: readStoredProjectId(),
  setActiveProject: (id) => {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, id);
    }
    set({ activeProjectId: id });
  },
}));
