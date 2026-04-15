import { useProjectStore } from "@/stores/projectStore";
import { useProjectState } from "@/hooks/useViews";
import type { MilestoneState, SetState } from "@/types/api";
import { useState } from "react";
import {
  PageHeader,
  StatCard,
  StatusBadge,
  SurfaceCard,
  EmptyState,
} from "@/components/primitives";
import type { StatusDotTone } from "@/components/primitives";

function statusTone(status: string): StatusDotTone {
  switch (status) {
    case "pending":
      return "muted";
    case "discussed":
      return "warning";
    case "planned":
      return "info";
    case "executing":
      return "orange";
    case "complete":
      return "accent";
    case "merged":
      return "muted";
    default:
      return "muted";
  }
}

function SetGrid({ sets }: { sets: SetState[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {sets.map((s) => (
        <div key={s.id} className="flex items-center gap-1.5">
          <StatusBadge label={s.status} tone={statusTone(s.status)} />
          <span className="text-sm text-fg font-mono">{s.id}</span>
        </div>
      ))}
    </div>
  );
}

function MilestoneCard({ milestone }: { milestone: MilestoneState }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <SurfaceCard elevation={1} className="p-4">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-muted text-sm">{expanded ? "\u25BC" : "\u25B6"}</span>
        <h3 className="text-lg font-semibold text-fg font-mono">{milestone.id}</h3>
        <span className="text-sm text-muted">{milestone.name}</span>
        <span className="ml-auto text-xs text-muted">
          {milestone.sets.length} set{milestone.sets.length !== 1 ? "s" : ""}
        </span>
      </button>
      {expanded && <SetGrid sets={milestone.sets} />}
    </SurfaceCard>
  );
}

export function StatePage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { data, isLoading, isError, error } = useProjectState(activeProjectId);

  if (!activeProjectId) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="State"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "State" }]}
          description="Live project state. Canonical source is .planning/STATE.json."
        />
        <EmptyState
          title="No project selected"
          description="Select a project from the sidebar to view state."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="State"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "State" }]}
          description="Live project state. Canonical source is .planning/STATE.json."
        />
        <div className="space-y-4">
          <div className="h-16 bg-surface-1 rounded-lg animate-pulse" />
          <div className="h-32 bg-surface-1 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const is404 = error && "status" in error && error.status === 404;
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="State"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "State" }]}
          description="Live project state. Canonical source is .planning/STATE.json."
        />
        <EmptyState
          title={is404 ? "No STATE.json found" : "Failed to load project state"}
          description={
            is404
              ? "No STATE.json found for this project."
              : "Check that the backend is running and try again."
          }
        />
      </div>
    );
  }

  const totalSets = data.milestones.reduce((sum, m) => sum + m.sets.length, 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="State"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "State" }]}
        description={`Live project state. Canonical source is .planning/STATE.json. Project: ${data.project_name}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SurfaceCard elevation={1} className="p-4">
          <StatCard label="Milestones" value={data.milestones.length} tone="accent" />
        </SurfaceCard>
        <SurfaceCard elevation={1} className="p-4">
          <StatCard label="Total Sets" value={totalSets} tone="info" />
        </SurfaceCard>
        <SurfaceCard elevation={1} className="p-4">
          <StatCard
            label="Current Milestone"
            value={data.current_milestone ?? "--"}
            tone="accent"
          />
        </SurfaceCard>
      </div>

      <SurfaceCard elevation={1} className="p-0 overflow-hidden">
        <div className="p-4 space-y-4">
          {data.milestones.map((m) => (
            <MilestoneCard key={m.id} milestone={m} />
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}
