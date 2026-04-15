import { useHealthCheck, useProjects } from "@/hooks/useProjects";
import { useProjectStore } from "@/stores/projectStore";
import { PendingPromptController } from "@/components/prompts/PendingPromptController";
import {
  PageHeader,
  NextActionBanner,
  StatCard,
  SurfaceCard,
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/primitives";

interface ActivityRow {
  id: string;
  time: string;
  agent: string;
  message: string;
  status: { label: string; tone: "accent" | "info" | "warning" | "muted" };
}

export function DashboardPage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { data: projectsData } = useProjects();
  const activeProject = projectsData?.items.find(
    (p) => p.id === activeProjectId,
  );

  // TODO: replace stub values with consolidated_dashboard_endpoint data.
  const setsInProgress = "--";
  const runningAgents = 0;
  const wavesExecutedToday = 0;
  const worktreeCount = "--";

  const activityRows: ActivityRow[] = [];

  const activityCols: Column<ActivityRow>[] = [
    {
      id: "time",
      header: "Time",
      cell: (r) => <span className="font-mono text-xs text-muted">{r.time}</span>,
    },
    {
      id: "agent",
      header: "Agent",
      cell: (r) => <span className="font-mono text-xs text-fg">{r.agent}</span>,
    },
    {
      id: "message",
      header: "Message",
      cell: (r) => <span className="text-sm text-fg">{r.message}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => <StatusBadge label={r.status.label} tone={r.status.tone} />,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        breadcrumb={[{ label: "RAPID" }, { label: "Dashboard" }]}
        description="Welcome to RAPID Mission Control"
      />

      {/* TODO: wire NextActionBanner to consolidated_dashboard_endpoint */}
      <NextActionBanner
        command="rapid:execute-set web-tool-bridge"
        status={{ label: "ready", tone: "accent" }}
        description="Next suggested action. Stub wiring — populated by consolidated_dashboard_endpoint."
      />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SurfaceCard elevation={1} className="p-4">
          <StatCard label="Sets in progress" value={setsInProgress} tone="accent" />
        </SurfaceCard>
        <SurfaceCard elevation={1} className="p-4">
          {/* TODO: populate running agents from agent runtime telemetry */}
          <StatCard label="Running agents" value={runningAgents} tone="info" />
        </SurfaceCard>
        <SurfaceCard elevation={1} className="p-4">
          <StatCard
            label="Waves executed today"
            value={wavesExecutedToday}
            tone="orange"
          />
        </SurfaceCard>
        <SurfaceCard elevation={1} className="p-4">
          <StatCard label="Worktrees" value={worktreeCount} tone="accent" />
        </SurfaceCard>
      </div>

      {/* Two-column section: activity + metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <SurfaceCard elevation={1} className="p-4">
          <h2 className="text-xs uppercase tracking-wider text-muted mb-3 font-semibold">
            Recent Activity
          </h2>
          <DataTable
            columns={activityCols}
            rows={activityRows}
            getRowKey={(r) => r.id}
            empty={
              <p className="text-sm text-muted text-center py-6">
                No recent activity
              </p>
            }
          />
        </SurfaceCard>

        <SurfaceCard elevation={1} className="p-4">
          <h2 className="text-xs uppercase tracking-wider text-muted mb-3 font-semibold">
            Project Metadata
          </h2>
          {activeProject ? (
            <dl className="text-sm space-y-2">
              <div>
                <dt className="text-muted text-xs">Name</dt>
                <dd className="font-mono text-fg">{activeProject.name}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Path</dt>
                <dd className="font-mono text-xs text-fg break-all">
                  {activeProject.path}
                </dd>
              </div>
              <HealthRow />
            </dl>
          ) : (
            <p className="text-sm text-muted">No project selected.</p>
          )}
        </SurfaceCard>
      </div>

      {/*
        Ask-user prompt bridge (web-tool-bridge wave 2, task 6).
        Mounted with runId={null} as a deliberate placeholder: the backend
        bridge (Wave 1) + modal + hooks infrastructure are all landed, but
        the "current active agent run" accessor is owned by a downstream
        set (see wave-2-PLAN.md Task 6 rationale). When that wiring lands,
        swap null for the active run id and the modal will light up.
        Until then, this controller renders null unconditionally.
      */}
      <PendingPromptController runId={null} />
    </div>
  );
}

function HealthRow() {
  const { data, isError } = useHealthCheck();
  if (isError) {
    return (
      <>
        <div>
          <dt className="text-muted text-xs">Backend</dt>
          <dd>
            <StatusBadge label="offline" tone="error" />
          </dd>
        </div>
      </>
    );
  }
  if (!data) {
    return (
      <div>
        <dt className="text-muted text-xs">Backend</dt>
        <dd>
          <StatusBadge label="checking" tone="muted" />
        </dd>
      </div>
    );
  }
  return (
    <>
      <div>
        <dt className="text-muted text-xs">Backend</dt>
        <dd>
          <StatusBadge label="online" tone="accent" />
        </dd>
      </div>
      <div>
        <dt className="text-muted text-xs">Version</dt>
        <dd className="font-mono text-xs text-fg">{data.version}</dd>
      </div>
      <div>
        <dt className="text-muted text-xs">Uptime</dt>
        <dd className="font-mono text-xs text-fg">{formatUptime(data.uptime)}</dd>
      </div>
    </>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
