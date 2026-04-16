import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { PageHeader } from "@/components/primitives";
import { SkillGallery } from "@/components/skills/SkillGallery";
import { RunLauncher } from "@/components/skills/RunLauncher";
import { useSkills } from "@/hooks/useSkills";
import { useProjectStore } from "@/stores/projectStore";
import type { SkillCategory, GalleryFilters } from "@/types/skills";

export function AgentsPage() {
  const navigate = useNavigate();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const [filters, setFilters] = useState<GalleryFilters>({
    categories: new Set<SkillCategory>(["autonomous", "human-in-loop"]),
    showAll: false,
    query: "",
  });
  const [launcherSkill, setLauncherSkill] = useState<string | null>(null);

  const { data: skills = [] } = useSkills();

  const filteredSkills = useMemo(() => {
    if (filters.showAll) return skills;
    return skills.filter((s) =>
      s.categories.some((c) => filters.categories.has(c)),
    );
  }, [skills, filters]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Agents"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Agents" }]}
        description="Launch autonomous skill runs and monitor agent activity."
      />

      <SkillGallery
        skills={filteredSkills}
        filters={filters}
        onFiltersChange={setFilters}
        onPick={(s) => setLauncherSkill(s.name)}
      />

      <RunLauncher
        open={launcherSkill !== null}
        skillName={launcherSkill}
        projectId={activeProjectId ?? ""}
        onClose={() => setLauncherSkill(null)}
        onLaunched={(runId) => {
          setLauncherSkill(null);
          navigate(`/chats/${runId}`);
        }}
      />
    </div>
  );
}
