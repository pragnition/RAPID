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
import { useChats } from "@/hooks/useChats";
import { useDashboard } from "@/hooks/useDashboard";
import { useSkills } from "@/hooks/useSkills";
import { useStatusStore } from "@/stores/statusStore";
import { useProjectStore } from "@/stores/projectStore";
import { ChatsEmptyState } from "@/components/empty-states/ChatsEmptyState";
import type { Chat, ChatSessionStatus } from "@/types/chats";
import type { SkillCategory, GalleryFilters } from "@/types/skills";

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

type BadgeTone = Parameters<typeof StatusBadge>[0]["tone"];

const SESSION_STATUS_TONE: Record<ChatSessionStatus, BadgeTone> = {
  active: "accent",
  idle: "muted",
  archived: "info",
};

const SESSION_STATUS_LABEL: Record<ChatSessionStatus, string> = {
  active: "ACTIVE",
  idle: "IDLE",
  archived: "ARCHIVED",
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatsPage() {
  const navigate = useNavigate();
  const projectId = useProjectStore((s) => s.activeProjectId);
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryFilters, setGalleryFilters] = useState<GalleryFilters>({
    categories: new Set<SkillCategory>(["interactive", "human-in-loop"]),
    showAll: false,
    query: "",
  });

  // Data hooks
  useDashboard(projectId);
  const chats = useStatusStore((s) => s.chats);
  const { threads, isLoading, createThread } = useChats({ includeArchived });
  const { data: skills = [] } = useSkills();

  // Gallery skills filtered for interactive
  const gallerySkills = useMemo(() => {
    if (galleryFilters.showAll) return skills;
    return skills.filter((s) =>
      s.categories.some((c) => galleryFilters.categories.has(c)),
    );
  }, [skills, galleryFilters]);

  // Filter threads by query
  const filtered = useMemo(() => {
    if (!query) return threads;
    const q = query.toLowerCase();
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.skill_name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q),
    );
  }, [threads, query]);

  const columns: Column<Chat>[] = useMemo(
    () => [
      {
        id: "title",
        header: "Title",
        cell: (row) => (
          <span className="text-sm font-medium text-fg">{row.title}</span>
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
        id: "last_message_at",
        header: "Last Message",
        cell: (row) => (
          <span className="font-mono text-sm">
            {formatTimestamp(row.last_message_at)}
          </span>
        ),
      },
      {
        id: "session_status",
        header: "Status",
        cell: (row) => (
          <StatusBadge
            label={SESSION_STATUS_LABEL[row.session_status]}
            tone={SESSION_STATUS_TONE[row.session_status]}
          />
        ),
      },
    ],
    [],
  );

  const handleSkillPick = async (skillName: string) => {
    setGalleryOpen(false);
    try {
      const thread = await createThread({ skillName });
      navigate(`/chats/${thread.id}`);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Chats"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Chats" }]}
        description="Interactive conversations with Claude."
        actions={
          <div className="flex items-center gap-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Filter threads..."
            />
            <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="accent-accent"
              />
              Show archived
            </label>
            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="px-4 py-1.5 text-sm font-semibold rounded bg-accent text-bg-0 hover:opacity-90 whitespace-nowrap"
            >
              New Chat
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Active" value={chats?.active ?? 0} tone="accent" />
        <StatCard label="Idle" value={chats?.idle ?? 0} tone="warning" />
        <StatCard label="Archived" value={chats?.archived ?? 0} tone="info" />
      </div>

      {!isLoading && filtered.length === 0 ? (
        <ChatsEmptyState />
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          getRowKey={(r) => r.id}
          onRowClick={(row) => navigate(`/chats/${row.id}`)}
        />
      )}

      {/* Gallery modal for new chat skill selection */}
      {galleryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-surface-1 border border-border rounded-lg shadow-xl p-6">
            <SkillGallery
              skills={gallerySkills}
              filters={galleryFilters}
              onFiltersChange={setGalleryFilters}
              onPick={(s) => handleSkillPick(s.name)}
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
    </div>
  );
}
