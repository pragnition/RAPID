import { describe, it, expect, beforeEach } from "vitest";
import { useStatusStore } from "../statusStore";
import type {
  RunsSummary,
  ChatsSummary,
  KanbanSummary,
  BudgetRemaining,
  ActivityItem,
} from "@/types/dashboard";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RUNS: RunsSummary = {
  running: 2,
  waiting: 1,
  failed: 0,
  completed: 5,
  recent: [
    { id: "r1", skill_name: "plan-set", status: "running", started_at: "2026-04-16T10:00:00Z" },
  ],
};

const CHATS: ChatsSummary = {
  active: 3,
  idle: 1,
  archived: 0,
  recent: [
    { id: "c1", title: "Discuss set", skill_name: "discuss-set", last_message_at: "2026-04-16T10:05:00Z", session_status: "active" },
  ],
};

const KANBAN: KanbanSummary = { total: 10, in_progress: 3, blocked: 1 };

const BUDGET: BudgetRemaining = { daily_cap: 50, spent_today: 12.5, remaining: 37.5 };

const ACTIVITY: ActivityItem[] = [
  { kind: "run", id: "r1", title: "plan-set", status: "running", ts: "2026-04-16T10:00:00Z" },
  { kind: "chat", id: "c1", title: "Discuss set", status: "active", ts: "2026-04-16T10:05:00Z" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("statusStore", () => {
  beforeEach(() => {
    useStatusStore.getState().reset();
  });

  it("initial state is nulls and empty arrays", () => {
    const state = useStatusStore.getState();
    expect(state.runs).toBeNull();
    expect(state.chats).toBeNull();
    expect(state.kanban).toBeNull();
    expect(state.budget).toBeNull();
    expect(state.recentRuns).toEqual([]);
    expect(state.recentThreads).toEqual([]);
    expect(state.recentActivity).toEqual([]);
    expect(state.lastSyncedAt).toBeNull();
    expect(state.lastError).toBeNull();
  });

  it("setDashboard populates counts and recents", () => {
    useStatusStore.getState().setDashboard({
      runs: RUNS,
      chats: CHATS,
      kanban: KANBAN,
      budget: BUDGET,
      recentActivity: ACTIVITY,
    });
    const state = useStatusStore.getState();
    expect(state.runs).toEqual({ running: 2, waiting: 1, failed: 0, completed: 5 });
    expect(state.chats).toEqual({ active: 3, idle: 1, archived: 0 });
    expect(state.kanban).toEqual(KANBAN);
    expect(state.budget).toEqual(BUDGET);
    expect(state.recentRuns).toHaveLength(1);
    expect(state.recentRuns[0].id).toBe("r1");
    expect(state.recentThreads).toHaveLength(1);
    expect(state.recentThreads[0].id).toBe("c1");
    expect(state.recentActivity).toEqual(ACTIVITY);
  });

  it("setDashboard updates lastSyncedAt", () => {
    const before = Date.now();
    useStatusStore.getState().setDashboard({
      runs: RUNS,
      chats: CHATS,
      kanban: KANBAN,
      budget: BUDGET,
      recentActivity: ACTIVITY,
    });
    const after = Date.now();
    const synced = useStatusStore.getState().lastSyncedAt;
    expect(synced).not.toBeNull();
    expect(synced).toBeGreaterThanOrEqual(before);
    expect(synced).toBeLessThanOrEqual(after);
  });

  it("setDashboard clears lastError", () => {
    useStatusStore.getState().setLastError("network failure");
    expect(useStatusStore.getState().lastError).toBe("network failure");

    useStatusStore.getState().setDashboard({
      runs: RUNS,
      chats: CHATS,
      kanban: KANBAN,
      budget: BUDGET,
      recentActivity: ACTIVITY,
    });
    expect(useStatusStore.getState().lastError).toBeNull();
  });

  it("reset returns to initial state", () => {
    useStatusStore.getState().setDashboard({
      runs: RUNS,
      chats: CHATS,
      kanban: KANBAN,
      budget: BUDGET,
      recentActivity: ACTIVITY,
    });
    useStatusStore.getState().reset();
    const state = useStatusStore.getState();
    expect(state.runs).toBeNull();
    expect(state.chats).toBeNull();
    expect(state.kanban).toBeNull();
    expect(state.budget).toBeNull();
    expect(state.recentRuns).toEqual([]);
    expect(state.lastSyncedAt).toBeNull();
  });

  it("setLastError preserves existing data", () => {
    useStatusStore.getState().setDashboard({
      runs: RUNS,
      chats: CHATS,
      kanban: KANBAN,
      budget: BUDGET,
      recentActivity: ACTIVITY,
    });
    useStatusStore.getState().setLastError("server down");
    const state = useStatusStore.getState();
    expect(state.lastError).toBe("server down");
    // Data should still be there
    expect(state.runs).toEqual({ running: 2, waiting: 1, failed: 0, completed: 5 });
    expect(state.recentRuns).toHaveLength(1);
  });
});
