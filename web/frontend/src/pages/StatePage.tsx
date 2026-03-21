import { useProjectStore } from "@/stores/projectStore";
import { useProjectState } from "@/hooks/useViews";
import type { MilestoneState, SetState } from "@/types/api";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-500/20 text-gray-400",
  discussed: "bg-yellow-500/20 text-yellow-400",
  planned: "bg-blue-500/20 text-blue-400",
  executing: "bg-orange-500/20 text-orange-400",
  complete: "bg-green-500/20 text-green-400",
  merged: "bg-gray-500/10 text-gray-500",
};

function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] ?? "bg-gray-500/20 text-gray-400";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  );
}

function SetGrid({ sets }: { sets: SetState[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {sets.map((s) => (
        <div key={s.id} className="flex items-center gap-1.5">
          <StatusBadge status={s.status} />
          <span className="text-sm text-fg">{s.id}</span>
        </div>
      ))}
    </div>
  );
}

function MilestoneCard({ milestone }: { milestone: MilestoneState }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-muted text-sm">{expanded ? "\u25BC" : "\u25B6"}</span>
        <h3 className="text-lg font-semibold text-fg">{milestone.id}</h3>
        <span className="text-sm text-muted">{milestone.name}</span>
        <span className="ml-auto text-xs text-muted">
          {milestone.sets.length} set{milestone.sets.length !== 1 ? "s" : ""}
        </span>
      </button>
      {expanded && <SetGrid sets={milestone.sets} />}
    </div>
  );
}

export function StatePage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { data, isLoading, isError, error } = useProjectState(activeProjectId);

  if (!activeProjectId) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Project State</h1>
        <p className="text-muted">Select a project from the sidebar to view state</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Project State</h1>
        <div className="space-y-4">
          <div className="h-16 bg-surface-1 rounded-lg animate-pulse" />
          <div className="h-32 bg-surface-1 rounded-lg animate-pulse" />
          <div className="h-32 bg-surface-1 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError) {
    const is404 = error && "status" in error && error.status === 404;
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Project State</h1>
        {is404 ? (
          <p className="text-muted">No STATE.json found for this project</p>
        ) : (
          <p className="text-red-400">
            Failed to load project state. Check that the backend is running and try again.
          </p>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-fg mb-2">Project State</h1>
        <p className="text-muted">No STATE.json found for this project</p>
      </div>
    );
  }

  const totalSets = data.milestones.reduce((sum, m) => sum + m.sets.length, 0);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-fg mb-2">Project State</h1>
      <p className="text-muted mb-6">{data.project_name}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-muted mb-1">Milestones</h2>
          <p className="text-2xl font-bold text-accent">{data.milestones.length}</p>
        </div>
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-muted mb-1">Total Sets</h2>
          <p className="text-2xl font-bold text-accent">{totalSets}</p>
        </div>
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-muted mb-1">Current Milestone</h2>
          <p className="text-2xl font-bold text-accent">
            {data.current_milestone ?? "--"}
          </p>
        </div>
      </div>

      {/* Milestone list */}
      <div className="space-y-4">
        {data.milestones.map((m) => (
          <MilestoneCard key={m.id} milestone={m} />
        ))}
      </div>
    </div>
  );
}
