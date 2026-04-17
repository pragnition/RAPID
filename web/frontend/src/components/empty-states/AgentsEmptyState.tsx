import { useState } from "react";
import { EmptyState } from "@/components/primitives";
import { RunLauncher } from "@/components/skills/RunLauncher";
import { useProjectStore } from "@/stores/projectStore";

const ACTIONS = [
  { skill: "status", label: "/rapid:status", desc: "Show project dashboard" },
  {
    skill: "plan-set",
    label: "/rapid:plan-set",
    desc: "Plan all waves in a set",
  },
  {
    skill: "execute-set",
    label: "/rapid:execute-set",
    desc: "Execute all waves in a set",
  },
];

export function AgentsEmptyState() {
  const [launcherSkill, setLauncherSkill] = useState<string | null>(null);
  const projectId = useProjectStore((s) => s.activeProjectId);

  return (
    <>
      <EmptyState
        title="No agent runs yet"
        description="Agents run autonomously in the background. Agents stream activity; chats wait for your replies."
        actions={
          <div className="flex flex-col gap-2 w-full">
            {ACTIONS.map((a) => (
              <button
                key={a.skill}
                type="button"
                onClick={() => setLauncherSkill(a.skill)}
                className="flex items-center gap-3 px-4 py-2 rounded border border-border bg-surface-1 hover:border-accent hover:bg-hover text-left transition-colors w-full"
              >
                <span className="font-mono text-sm text-accent">
                  {a.label}
                </span>
                <span className="text-xs text-muted">{a.desc}</span>
              </button>
            ))}
          </div>
        }
      />
      <RunLauncher
        open={launcherSkill !== null}
        skillName={launcherSkill}
        projectId={projectId ?? ""}
        onClose={() => setLauncherSkill(null)}
        onLaunched={() => setLauncherSkill(null)}
      />
    </>
  );
}
