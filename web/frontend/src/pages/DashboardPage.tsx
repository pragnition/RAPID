import { useHealthCheck, useProjects } from "@/hooks/useProjects";
import { useProjectStore } from "@/stores/projectStore";

export function DashboardPage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { data: projectsData } = useProjects();
  const activeProject = projectsData?.items.find(
    (p) => p.id === activeProjectId,
  );

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-fg mb-2">Dashboard</h1>
      <p className="text-muted mb-8">Welcome to RAPID Mission Control</p>

      {/* Active project card */}
      {activeProject && (
        <div className="bg-surface-1 border border-border rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-muted mb-1">
            Active Project
          </h2>
          <p className="text-xl font-bold text-accent">{activeProject.name}</p>
          <p className="text-xs text-muted mt-1 font-mono">
            {activeProject.path}
          </p>
        </div>
      )}

      {/* Widget cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-fg mb-1">
            Active Projects
          </h2>
          <p className="text-2xl font-bold text-accent">
            {projectsData?.total ?? "--"}
          </p>
        </div>
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-fg mb-1">
            Running Agents
          </h2>
          <p className="text-2xl font-bold text-accent">--</p>
        </div>
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-fg mb-1">
            Sets in Progress
          </h2>
          <p className="text-2xl font-bold text-accent">--</p>
        </div>
      </div>

      {/* Health indicator */}
      <HealthIndicator />
    </div>
  );
}

function HealthIndicator() {
  const { data, isError } = useHealthCheck();

  if (isError) {
    return (
      <div className="bg-surface-1 border border-border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-error" />
          <span className="text-sm font-medium text-error">
            Backend offline
          </span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-surface-1 border border-border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-muted animate-pulse" />
          <span className="text-sm text-muted">Checking backend...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent" />
        <span className="text-sm font-medium text-accent">
          Backend connected
        </span>
      </div>
      <div className="flex gap-6 text-xs text-muted">
        <span>
          Version: <span className="text-fg">{data.version}</span>
        </span>
        <span>
          Uptime: <span className="text-fg">{formatUptime(data.uptime)}</span>
        </span>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
