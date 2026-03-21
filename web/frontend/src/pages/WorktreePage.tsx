import { useProjectStore } from "@/stores/projectStore";
import { useWorktreeRegistry } from "@/hooks/useViews";
import type { WorktreeInfo } from "@/types/api";
import { useMemo } from "react";

function statusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-500/20 text-green-400";
    case "orphaned":
      return "bg-orange-500/20 text-orange-400";
    default:
      return "bg-gray-500/20 text-gray-400";
  }
}

function mergeStatusColor(mergeStatus: string | null): string {
  switch (mergeStatus) {
    case "merged":
      return "bg-green-500/20 text-green-400";
    case "complete":
      return "bg-blue-500/20 text-blue-400";
    default:
      return "";
  }
}

function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {text}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function WorktreeCard({ wt }: { wt: WorktreeInfo }) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4 md:hidden">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-fg font-semibold">{wt.set_name}</span>
        {wt.solo && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
            solo
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-y-1 text-sm">
        <span className="text-muted">Branch</span>
        <span className="text-fg font-mono text-xs">{wt.branch}</span>
        <span className="text-muted">Status</span>
        <Badge text={wt.status} className={statusColor(wt.status)} />
        <span className="text-muted">Phase</span>
        <span className="text-fg">{wt.phase}</span>
        <span className="text-muted">Merge</span>
        {wt.merge_status ? (
          <Badge text={wt.merge_status} className={mergeStatusColor(wt.merge_status)} />
        ) : (
          <span className="text-muted">--</span>
        )}
        <span className="text-muted">Created</span>
        <span className="text-fg text-xs">{formatDate(wt.created_at)}</span>
      </div>
    </div>
  );
}

export function WorktreePage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { data, isLoading, isError, error } = useWorktreeRegistry(activeProjectId);

  const sorted = useMemo(() => {
    if (!data?.worktrees) return [];
    return [...data.worktrees].sort((a, b) => {
      // Active first
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;
      // Then by created_at descending
      const aDate = a.created_at ?? "";
      const bDate = b.created_at ?? "";
      return bDate.localeCompare(aDate);
    });
  }, [data]);

  if (!activeProjectId) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Worktrees</h1>
        <p className="text-muted">Select a project from the sidebar to view worktrees</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Worktrees</h1>
        <div className="space-y-4">
          <div className="h-12 bg-surface-1 rounded-lg animate-pulse" />
          <div className="h-48 bg-surface-1 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError) {
    const is404 = error && "status" in error && error.status === 404;
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Worktrees</h1>
        {is404 ? (
          <p className="text-muted">No REGISTRY.json found for this project</p>
        ) : (
          <p className="text-red-400">
            Failed to load worktree data. Check that the backend is running and try again.
          </p>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Worktrees</h1>
        <p className="text-muted">No REGISTRY.json found for this project</p>
      </div>
    );
  }

  const activeCount = data.worktrees.filter((w) => w.status === "active").length;
  const mergedCount = data.worktrees.filter((w) => w.merge_status === "merged").length;
  const orphanedCount = data.worktrees.filter((w) => w.status === "orphaned").length;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-fg mb-2">Worktrees</h1>
      <p className="text-muted mb-6">{data.worktrees.length} registered worktree{data.worktrees.length !== 1 ? "s" : ""}</p>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-muted mb-1">Total</h2>
          <p className="text-2xl font-bold text-accent">{data.worktrees.length}</p>
        </div>
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-muted mb-1">Active</h2>
          <p className="text-2xl font-bold text-green-400">{activeCount}</p>
        </div>
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-muted mb-1">Merged</h2>
          <p className="text-2xl font-bold text-blue-400">{mergedCount}</p>
        </div>
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-muted mb-1">Orphaned</h2>
          <p className="text-2xl font-bold text-orange-400">{orphanedCount}</p>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {sorted.map((wt) => (
          <WorktreeCard key={wt.set_name} wt={wt} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-surface-1 border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-left border-b border-border">
              <th className="px-4 py-3 font-medium">Set Name</th>
              <th className="px-4 py-3 font-medium">Branch</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Phase</th>
              <th className="px-4 py-3 font-medium">Merge Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((wt) => (
              <tr key={wt.set_name} className="border-t border-border">
                <td className="px-4 py-3 text-fg font-medium">
                  <span className="flex items-center gap-1.5">
                    {wt.set_name}
                    {wt.solo && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                        solo
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-fg">{wt.branch}</td>
                <td className="px-4 py-3">
                  <Badge text={wt.status} className={statusColor(wt.status)} />
                </td>
                <td className="px-4 py-3 text-fg">{wt.phase}</td>
                <td className="px-4 py-3">
                  {wt.merge_status ? (
                    <Badge text={wt.merge_status} className={mergeStatusColor(wt.merge_status)} />
                  ) : (
                    <span className="text-muted">--</span>
                  )}
                </td>
                <td className="px-4 py-3 text-fg text-xs">{formatDate(wt.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <p className="text-muted text-center py-8">No worktrees registered</p>
      )}
    </div>
  );
}
