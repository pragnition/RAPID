import { useProjects } from "@/hooks/useProjects";
import { useProjectStore } from "@/stores/projectStore";

export function ProjectsPage() {
  const { data, isLoading, isError, error, refetch } = useProjects();
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-fg mb-2">Projects</h1>
      <p className="text-muted mb-6">Registered RAPID projects</p>

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <div className="bg-surface-1 border border-border rounded-lg p-6 text-center">
          <p className="text-error mb-3">
            Failed to load projects{error?.detail ? `: ${error.detail}` : ""}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="
              px-4 py-2 text-sm font-medium
              bg-accent text-bg-0 rounded
              hover:opacity-90 transition-opacity
            "
          >
            Retry
          </button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="bg-surface-1 border border-border rounded-lg p-8 text-center">
          <p className="text-muted text-lg">No projects registered yet</p>
          <p className="text-muted text-sm mt-2">
            Register a project via the CLI to get started
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 px-4 font-semibold text-muted">Name</th>
                <th className="py-3 px-4 font-semibold text-muted">Path</th>
                <th className="py-3 px-4 font-semibold text-muted">Status</th>
                <th className="py-3 px-4 font-semibold text-muted">Milestone</th>
                <th className="py-3 px-4 font-semibold text-muted">Sets</th>
                <th className="py-3 px-4 font-semibold text-muted">Registered</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((project) => (
                <tr
                  key={project.id}
                  onClick={() => setActiveProject(project.id)}
                  className="
                    bg-surface-0 border-b border-border
                    hover:bg-hover cursor-pointer
                    transition-colors duration-100
                  "
                >
                  <td className="py-3 px-4 text-fg font-medium">
                    {project.name}
                  </td>
                  <td className="py-3 px-4 text-muted font-mono text-xs truncate max-w-48">
                    {project.path}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={project.status} />
                  </td>
                  <td className="py-3 px-4 text-fg">
                    {project.current_milestone ?? "--"}
                  </td>
                  <td className="py-3 px-4 text-fg tabular-nums">
                    {project.set_count}
                  </td>
                  <td className="py-3 px-4 text-muted text-xs">
                    {formatDate(project.registered_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="bg-surface-1 rounded-lg h-14 animate-pulse"
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorClass =
    status === "active"
      ? "bg-accent/20 text-accent"
      : status === "error"
        ? "bg-error/20 text-error"
        : "bg-surface-2 text-muted";

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}
    >
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
