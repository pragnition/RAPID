import { useProjectStore } from "@/stores/projectStore";
import { useWorktreeRegistry } from "@/hooks/useViews";
import type { WorktreeInfo } from "@/types/api";
import { useMemo } from "react";
import {
  PageHeader,
  DataTable,
  EmptyState,
  StatusBadge,
  StatCard,
  SurfaceCard,
  type Column,
} from "@/components/primitives";
import type { StatusDotTone } from "@/components/primitives";

function statusTone(status: string): StatusDotTone {
  switch (status) {
    case "active":
      return "accent";
    case "orphaned":
      return "orange";
    default:
      return "muted";
  }
}

function mergeStatusTone(mergeStatus: string | null): StatusDotTone {
  switch (mergeStatus) {
    case "merged":
      return "accent";
    case "complete":
      return "info";
    default:
      return "muted";
  }
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

export function WorktreePage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { data, isLoading, isError, error } = useWorktreeRegistry(activeProjectId);

  const sorted = useMemo(() => {
    if (!data?.worktrees) return [];
    return [...data.worktrees].sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;
      const aDate = a.created_at ?? "";
      const bDate = b.created_at ?? "";
      return bDate.localeCompare(aDate);
    });
  }, [data]);

  const columns: Column<WorktreeInfo>[] = [
    {
      id: "set",
      header: "Set",
      cell: (wt) => (
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-fg">{wt.set_name}</span>
          {wt.solo && (
            <StatusBadge label="solo" tone="highlight" />
          )}
        </span>
      ),
    },
    {
      id: "branch",
      header: "Branch",
      cell: (wt) => (
        <span className="font-mono text-xs text-muted">{wt.branch}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (wt) => <StatusBadge label={wt.status} tone={statusTone(wt.status)} />,
    },
    {
      id: "path",
      header: "Path",
      cell: (wt) => (
        <span className="font-mono text-xs text-muted truncate block max-w-xs">
          {wt.phase}
        </span>
      ),
    },
    {
      id: "last_commit",
      header: "Last commit",
      cell: (wt) => (
        <span className="font-mono text-xs text-muted">
          {formatDate(wt.created_at)}
        </span>
      ),
    },
    {
      id: "merge",
      header: "Merge",
      cell: (wt) =>
        wt.merge_status ? (
          <StatusBadge
            label={wt.merge_status}
            tone={mergeStatusTone(wt.merge_status)}
          />
        ) : (
          <span className="text-muted text-xs">--</span>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: () => (
        <button
          type="button"
          className="text-xs text-muted hover:text-accent font-mono"
        >
          Open
        </button>
      ),
      align: "right",
    },
  ];

  if (!activeProjectId) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Worktrees"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Worktrees" }]}
        />
        <EmptyState
          title="No project selected"
          description="Select a project from the sidebar to view worktrees."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Worktrees"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Worktrees" }]}
        />
        <div className="space-y-4">
          <div className="h-12 bg-surface-1 rounded-lg animate-pulse" />
          <div className="h-48 bg-surface-1 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const is404 = error && "status" in error && error.status === 404;
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Worktrees"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Worktrees" }]}
        />
        <EmptyState
          title={is404 ? "No registry found" : "Failed to load worktrees"}
          description={
            is404
              ? "No REGISTRY.json found for this project."
              : "Check that the backend is running and try again."
          }
        />
      </div>
    );
  }

  const activeCount = data.worktrees.filter((w) => w.status === "active").length;
  const mergedCount = data.worktrees.filter((w) => w.merge_status === "merged").length;
  const orphanedCount = data.worktrees.filter((w) => w.status === "orphaned").length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Worktrees"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Worktrees" }]}
        description={`${data.worktrees.length} registered worktree${data.worktrees.length !== 1 ? "s" : ""}`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SurfaceCard elevation={1} className="p-4">
          <StatCard label="Total" value={data.worktrees.length} tone="accent" />
        </SurfaceCard>
        <SurfaceCard elevation={1} className="p-4">
          <StatCard label="Active" value={activeCount} tone="accent" />
        </SurfaceCard>
        <SurfaceCard elevation={1} className="p-4">
          <StatCard label="Merged" value={mergedCount} tone="info" />
        </SurfaceCard>
        <SurfaceCard elevation={1} className="p-4">
          <StatCard label="Orphaned" value={orphanedCount} tone="warning" />
        </SurfaceCard>
      </div>

      <SurfaceCard elevation={1} className="p-0 overflow-hidden">
        <DataTable
          columns={columns}
          rows={sorted}
          getRowKey={(wt) => wt.set_name}
          empty={
            <EmptyState
              title="No worktrees registered"
              description="Registered worktrees will appear here."
            />
          }
        />
      </SurfaceCard>
    </div>
  );
}
