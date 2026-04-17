import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useProjects } from "@/hooks/useProjects";
import { useProjectStore } from "@/stores/projectStore";
import { apiClient } from "@/lib/apiClient";
import type { ProjectSummary } from "@/types/api";
import {
  PageHeader,
  DataTable,
  EmptyState,
  StatusBadge,
  SurfaceCard,
  type Column,
} from "@/components/primitives";
import type { StatusDotTone } from "@/components/primitives";

function projectStatusTone(status: string): StatusDotTone {
  if (status === "active") return "accent";
  if (status === "error") return "error";
  return "muted";
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

export function ProjectsPage() {
  const { data, isLoading, isError, error, refetch } = useProjects();
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const [showForm, setShowForm] = useState(false);

  const columns: Column<ProjectSummary>[] = [
    {
      id: "name",
      header: "Name",
      cell: (p) => <span className="font-mono text-fg">{p.name}</span>,
    },
    {
      id: "path",
      header: "Path",
      cell: (p) => (
        <span className="font-mono text-xs text-muted truncate block max-w-xs">
          {p.path}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (p) => (
        <StatusBadge label={p.status} tone={projectStatusTone(p.status)} />
      ),
    },
    {
      id: "milestone",
      header: "Milestone",
      cell: (p) => (
        <span className="font-mono text-xs text-fg">
          {p.current_milestone ?? "--"}
        </span>
      ),
    },
    {
      id: "sets",
      header: "Sets",
      cell: (p) => <span className="text-fg tabular-nums">{p.set_count}</span>,
    },
    {
      id: "registered",
      header: "Last activity",
      cell: (p) => (
        <span className="font-mono text-xs text-muted">
          {formatDate(p.registered_at)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: () => (
        <button
          type="button"
          className="text-xs text-muted hover:text-accent font-mono"
          onClick={(e) => e.stopPropagation()}
        >
          Open
        </button>
      ),
      align: "right",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Projects"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Projects" }]}
        description="Registered RAPID projects"
        actions={
          <button
            type="button"
            className="bg-accent text-bg-0 rounded px-3 py-1.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            onClick={() => setShowForm((s) => !s)}
          >
            Register Project
          </button>
        }
      />

      {showForm && <AddProjectForm onClose={() => setShowForm(false)} />}

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <SurfaceCard elevation={1} className="p-6 text-center">
          <p className="text-error mb-3">
            Failed to load projects{error?.detail ? `: ${error.detail}` : ""}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="px-4 py-2 text-sm font-medium bg-accent text-bg-0 rounded hover:opacity-90"
          >
            Retry
          </button>
        </SurfaceCard>
      )}

      {data && (
        <SurfaceCard elevation={1} className="p-0 overflow-hidden">
          <DataTable
            columns={columns}
            rows={data.items}
            getRowKey={(p) => p.id}
            onRowClick={(p) => setActiveProject(p.id)}
            empty={
              <EmptyState
                title="No projects registered yet"
                description="Register a project to begin."
                actions={
                  <button
                    type="button"
                    className="bg-accent text-bg-0 rounded px-3 py-1.5 text-sm font-semibold"
                    onClick={() => setShowForm(true)}
                  >
                    Register your first project
                  </button>
                }
              />
            }
          />
        </SurfaceCard>
      )}
    </div>
  );
}

function AddProjectForm({ onClose }: { onClose: () => void }) {
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
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) return;
    mutation.mutate({ path: path.trim(), name: name.trim() || undefined });
  };

  return (
    <SurfaceCard elevation={1} className="p-4">
      <form onSubmit={handleSubmit}>
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
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Failed to register project"}
          </p>
        )}
      </form>
    </SurfaceCard>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="bg-surface-1 rounded-lg h-14 animate-pulse" />
      ))}
    </div>
  );
}
