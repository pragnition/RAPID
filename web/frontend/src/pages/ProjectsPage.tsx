import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useProjects } from "@/hooks/useProjects";
import { useProjectStore } from "@/stores/projectStore";
import { apiClient } from "@/lib/apiClient";

export function ProjectsPage() {
  const { data, isLoading, isError, error, refetch } = useProjects();
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-fg mb-2">Projects</h1>
      <p className="text-muted mb-6">Registered RAPID projects</p>

      <AddProjectForm />

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
            Add a project using the form above
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

function AddProjectForm() {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body: { path: string; name?: string }) =>
      apiClient.post<{ id: string; status: string }>("/projects", body),
    onSuccess: () => {
      setPath("");
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) return;
    mutation.mutate({ path: path.trim(), name: name.trim() || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-surface-1 border border-border rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Absolute project path (e.g. /home/user/my-project)"
          className="flex-1 px-3 py-2 text-sm bg-surface-0 border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="sm:w-48 px-3 py-2 text-sm bg-surface-0 border border-border rounded text-fg placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!path.trim() || mutation.isPending}
          className="px-4 py-2 text-sm font-medium bg-accent text-bg-0 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {mutation.isPending ? "Adding..." : "Add Project"}
        </button>
      </div>
      {mutation.isError && (
        <p className="text-error text-sm mt-2">
          {mutation.error instanceof Error ? mutation.error.message : "Failed to register project"}
        </p>
      )}
      {mutation.isSuccess && (
        <p className="text-accent text-sm mt-2">Project registered successfully</p>
      )}
    </form>
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
