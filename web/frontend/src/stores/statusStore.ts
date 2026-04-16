import { create } from "zustand";
import type {
  RunsSummary,
  ChatsSummary,
  KanbanSummary,
  BudgetRemaining,
  ActivityItem,
} from "@/types/dashboard";

export interface StatusStore {
  // Aggregate counts
  runs: Omit<RunsSummary, "recent"> | null;
  chats: Omit<ChatsSummary, "recent"> | null;
  kanban: KanbanSummary | null;
  budget: BudgetRemaining | null;

  // Recent items (for activity feed / sparklines)
  recentRuns: RunsSummary["recent"];
  recentThreads: ChatsSummary["recent"];
  recentActivity: ActivityItem[];

  // Metadata
  lastSyncedAt: number | null; // Date.now() of last successful poll
  lastError: string | null;

  // Actions
  setDashboard: (snapshot: {
    runs: RunsSummary;
    chats: ChatsSummary;
    kanban: KanbanSummary;
    budget: BudgetRemaining;
    recentActivity: ActivityItem[];
  }) => void;
  setLastError: (err: string | null) => void;
  reset: () => void;
}

export const useStatusStore = create<StatusStore>((set) => ({
  runs: null,
  chats: null,
  kanban: null,
  budget: null,
  recentRuns: [],
  recentThreads: [],
  recentActivity: [],
  lastSyncedAt: null,
  lastError: null,

  setDashboard: (snapshot) =>
    set({
      runs: {
        running: snapshot.runs.running,
        waiting: snapshot.runs.waiting,
        failed: snapshot.runs.failed,
        completed: snapshot.runs.completed,
      },
      chats: {
        active: snapshot.chats.active,
        idle: snapshot.chats.idle,
        archived: snapshot.chats.archived,
      },
      kanban: snapshot.kanban,
      budget: snapshot.budget,
      recentRuns: snapshot.runs.recent,
      recentThreads: snapshot.chats.recent,
      recentActivity: snapshot.recentActivity,
      lastSyncedAt: Date.now(),
      lastError: null,
    }),
  setLastError: (err) => set({ lastError: err }),
  reset: () =>
    set({
      runs: null,
      chats: null,
      kanban: null,
      budget: null,
      recentRuns: [],
      recentThreads: [],
      recentActivity: [],
      lastSyncedAt: null,
      lastError: null,
    }),
}));
