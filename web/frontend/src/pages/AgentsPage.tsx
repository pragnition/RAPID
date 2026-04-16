import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  PageHeader,
  SearchInput,
  StatCard,
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/primitives";
import { SkillGallery } from "@/components/skills/SkillGallery";
import { RunLauncher } from "@/components/skills/RunLauncher";
import { useAgentRuns } from "@/hooks/useAgentRuns";
import { useDashboard } from "@/hooks/useDashboard";
import { useSkills } from "@/hooks/useSkills";
import { useStatusStore } from "@/stores/statusStore";
import { useProjectStore } from "@/stores/projectStore";
import { AgentsEmptyState } from "@/components/empty-states/AgentsEmptyState";
import type { AgentRun, AgentRunStatus } from "@/types/agents";
import type { SkillCategory, GalleryFilters } from "@/types/skills";

// ---------------------------------------------------------------------------
// Status badge tone mapping
// ---------------------------------------------------------------------------

type BadgeTone = Parameters<typeof StatusBadge>[0]["tone"];

const STATUS_TONE: Record<AgentRunStatus, BadgeTone> = {
  running: "accent",
  waiting: "warning",
  failed: "error",
  interrupted: "error",
  completed: "link",
  pending: "muted",
};

const STATUS_LABEL: Record<AgentRunStatus, string> = {
  running: "RUNNING",
  waiting: "WAITING",
  failed: "FAILED",
  interrupted: "INTERRUPTED",
  completed: "COMPLETED",
  pending: "PENDING",
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentsPage() {
  const navigate = useNavigate();
  const projectId = useProjectStore((s) => s.activeProjectId);
  const [query, setQuery] = useState("");

  // Two-step launcher: gallery -> skill launcher
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [launcherSkill, setLauncherSkill] = useState<string | null>(null);
  const [galleryFilters, setGalleryFilters] = useState<GalleryFilters>({
    categories: new Set<SkillCategory>(["autonomous", "human-in-loop"]),
    showAll: false,
    query: "",
  });

  // Data hooks
  useDashboard(projectId);
  const runs = useStatusStore((s) => s.runs);
  const { data: runsList, isLoading } = useAgentRuns();
  const { data: skills = [] } = useSkills();

  // Build skill category lookup for navigation routing
  const skillCategoryByName = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of skills) m.set(s.name, s.categories);
    return m;
  }, [skills]);

  // Navigate based on skill category: interactive -> /chats, else -> /agents
  const rowNavigate = (run: AgentRun) => {
    const cats = skillCategoryByName.get(run.skill_name) ?? [];
    if (cats.includes("interactive")) {
      // Interactive runs navigate to /chats/:threadId.
      // TODO: lookup the chat thread ID bound to this run. For now, fallback to /agents/:runId.
      navigate(`/agents/${run.id}`);
    } else {
      navigate(`/agents/${run.id}`);
    }
  };

  // Filter runs by query
  const filtered = useMemo(() => {
    const items = runsList?.items ?? [];
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(
      (r) =>
        r.skill_name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }, [runsList, query]);

  // Gallery skills filtered for the launcher
  const gallerySkills = useMemo(() => {
    if (galleryFilters.showAll) return skills;
    return skills.filter((s) =>
      s.categories.some((c) => galleryFilters.categories.has(c)),
    );
  }, [skills, galleryFilters]);

  const columns: Column<AgentRun>[] = useMemo(
    () => [
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <StatusBadge
            label={STATUS_LABEL[row.status]}
            tone={STATUS_TONE[row.status]}
          />
        ),
      },
      {
        id: "skill_name",
        header: "Skill",
        cell: (row) => (
          <span className="font-mono text-sm">{row.skill_name}</span>
        ),
      },
      {
        id: "started_at",
        header: "Started",
        cell: (row) => (
          <span className="font-mono text-sm">{formatTime(row.started_at)}</span>
        ),
      },
      {
        id: "active_duration_s",
        header: "Duration",
        cell: (row) => (
          <span className="font-mono text-sm">
            {formatDuration(row.active_duration_s)}
          </span>
        ),
      },
      {
        id: "set_id",
        header: "Set",
        cell: (row) => (
          <span className="font-mono text-sm">{row.set_id ?? "\u2014"}</span>
        ),
      },
      {
        id: "total_cost_usd",
        header: "Cost",
        align: "right" as const,
        cell: (row) => (
          <span className="font-mono text-sm">
            {formatCost(row.total_cost_usd)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Agents"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Agents" }]}
        description="Autonomous skill runs."
        actions={
          <div className="flex items-center gap-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Filter runs..."
            />
            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="px-4 py-1.5 text-sm font-semibold rounded bg-accent text-bg-0 hover:opacity-90 whitespace-nowrap"
            >
              Launch New Run
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Running" value={runs?.running ?? 0} tone="accent" />
        <StatCard label="Waiting" value={runs?.waiting ?? 0} tone="warning" />
        <StatCard label="Failed" value={runs?.failed ?? 0} tone="orange" />
        <StatCard label="Completed" value={runs?.completed ?? 0} tone="info" />
      </div>

      {!isLoading && filtered.length === 0 ? (
        <AgentsEmptyState />
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          getRowKey={(r) => r.id}
          onRowClick={rowNavigate}
        />
      )}

      {/* Gallery modal for skill selection */}
      {galleryOpen && !launcherSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-surface-1 border border-border rounded-lg shadow-xl p-6">
            <SkillGallery
              skills={gallerySkills}
              filters={galleryFilters}
              onFiltersChange={setGalleryFilters}
              onPick={(s) => {
                setGalleryOpen(false);
                setLauncherSkill(s.name);
              }}
            />
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setGalleryOpen(false)}
                className="px-3 py-1.5 text-sm rounded border border-border text-muted hover:bg-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skill Launcher modal */}
      <RunLauncher
        open={launcherSkill !== null}
        skillName={launcherSkill}
        projectId={projectId ?? ""}
        onClose={() => setLauncherSkill(null)}
        onLaunched={(runId) => {
          setLauncherSkill(null);
          navigate(`/agents/${runId}`);
        }}
      />
    </div>
  );
}
