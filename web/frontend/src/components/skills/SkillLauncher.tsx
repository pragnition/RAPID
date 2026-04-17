import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  ErrorCard,
} from "@/components/primitives";
import { useSkill } from "@/hooks/useSkills";
import { useProjectDetail } from "@/hooks/useProjects";
import {
  useSkillPreconditions,
  runPreconditionCheck,
} from "@/hooks/useSkillPreconditions";
import { apiClient, ApiError } from "@/lib/apiClient";
import type {
  SkillMeta,
  SkillArg,
  PreconditionBlocker,
} from "@/types/skills";
import { ArgField } from "./ArgField";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkillLauncherProps {
  skillName: string;
  projectId: string;
  defaultSetId?: string;
  onDispatched: (runId: string) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Best-effort prompt string to satisfy StartRunRequest.prompt min_length=1. */
function buildClientPromptPreview(
  skill: SkillMeta,
  formValues: Record<string, unknown>,
): string {
  return `/rapid:${skill.name} ${JSON.stringify(formValues)}`;
}

function initFormValues(
  args: SkillArg[],
  defaultSetId?: string,
): Record<string, unknown> {
  const vals: Record<string, unknown> = {};
  for (const arg of args) {
    if (arg.default != null) {
      vals[arg.name] = arg.default;
    } else {
      switch (arg.type) {
        case "bool":
          vals[arg.name] = false;
          break;
        case "string":
        case "multi-line":
        case "choice":
        case "set-ref":
          vals[arg.name] = "";
          break;
      }
    }
    // Override set-ref arg with defaultSetId when provided
    if (arg.type === "set-ref" && defaultSetId) {
      vals[arg.name] = defaultSetId;
    }
  }
  return vals;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SkillLauncher({
  skillName,
  projectId,
  defaultSetId,
  onDispatched,
  onCancel,
}: SkillLauncherProps) {
  const { data: skill, isLoading, error } = useSkill(skillName);
  const { data: projectDetail } = useProjectDetail(projectId);

  // Extract set IDs from the current milestone only
  const setSuggestions = useMemo(() => {
    if (!projectDetail?.milestones || !projectDetail.current_milestone) return [];
    const current = projectDetail.milestones.find(
      (ms) => (ms as Record<string, unknown>).id === projectDetail.current_milestone,
    );
    if (!current) return [];
    const sets = (current as Record<string, unknown>).sets;
    if (!Array.isArray(sets)) return [];
    return sets
      .map((s) => (s as Record<string, unknown>).id)
      .filter((id): id is string => typeof id === "string");
  }, [projectDetail]);

  // Form state -- initialized once the skill loads
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [overrideBlockers, setOverrideBlockers] = useState<
    PreconditionBlocker[] | null
  >(null);

  // Initialize form values when skill data arrives
  useEffect(() => {
    if (skill) {
      setFormValues(initFormValues(skill.args, defaultSetId));
    }
  }, [skill, defaultSetId]);

  // Derive setId from the set-ref form field, falling back to defaultSetId.
  // This ensures precondition checks and submit use the value the user selected.
  const effectiveSetId = useMemo(() => {
    if (defaultSetId) return defaultSetId;
    if (!skill) return null;
    const setRefArg = skill.args.find((a) => a.type === "set-ref");
    if (!setRefArg) return null;
    const v = formValues[setRefArg.name];
    return typeof v === "string" && v.length > 0 ? v : null;
  }, [defaultSetId, skill, formValues]);

  // Debounced precondition check
  const preconditions = useSkillPreconditions({
    skillName: skill ? skillName : null,
    projectId,
    skillArgs: formValues,
    setId: effectiveSetId,
  });

  // Merge debounced + override blockers
  const blockers: PreconditionBlocker[] = useMemo(() => {
    if (overrideBlockers) return overrideBlockers;
    return preconditions.data?.blockers ?? [];
  }, [overrideBlockers, preconditions.data]);

  const hasBlockers = blockers.length > 0;

  // Partition blockers: arg-specific vs global
  const argBlockerMap = useMemo(() => {
    const map = new Map<string, PreconditionBlocker>();
    for (const b of blockers) {
      if (b.arg) map.set(b.arg, b);
    }
    return map;
  }, [blockers]);

  const globalBlockers = useMemo(
    () => blockers.filter((b) => !b.arg),
    [blockers],
  );

  // Update a single form field
  const updateField = useCallback(
    (name: string, v: unknown) => {
      setFormValues((prev) => ({ ...prev, [name]: v }));
      // Clear override blockers on any form change so the debounced check takes over
      setOverrideBlockers(null);
    },
    [],
  );

  // ---- Submit handler ----

  const handleSubmit = useCallback(async () => {
    if (!skill || submitting) return;
    setSubmitting(true);
    try {
      // Hard (non-debounced) precondition re-check
      const check = await runPreconditionCheck({
        skillName,
        projectId,
        skillArgs: formValues,
        setId: effectiveSetId,
      });
      if (!check.ok) {
        setOverrideBlockers(check.blockers);
        return;
      }

      // Launch the run
      const response = await apiClient.post<{ id: string }>(
        "/agents/runs",
        {
          project_id: projectId,
          skill_name: skillName,
          skill_args: formValues,
          prompt: buildClientPromptPreview(skill, formValues),
          set_id: effectiveSetId,
          worktree: null,
        },
      );
      onDispatched(response.id);
    } catch (err) {
      // Handle 400 with precondition-shaped body
      if (err instanceof ApiError && err.status === 400) {
        try {
          const parsed = JSON.parse(err.detail);
          if (Array.isArray(parsed.blockers)) {
            setOverrideBlockers(parsed.blockers as PreconditionBlocker[]);
            return;
          }
        } catch {
          // not a precondition response -- fall through
        }
      }
      // Surface unexpected errors as a global blocker
      const message =
        err instanceof Error ? err.message : "Unexpected error launching skill";
      setOverrideBlockers([{ code: "LAUNCH_ERROR", message }]);
    } finally {
      setSubmitting(false);
    }
  }, [skill, skillName, projectId, formValues, effectiveSetId, onDispatched, submitting]);

  // ---- Loading / error states ----

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title={skillName} description="Loading skill details..." />
        <div className="text-sm text-muted animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title={skillName} description="Failed to load skill" />
        <ErrorCard
          title="Failed to load skill"
          body={error?.message ?? "Skill not found"}
        />
      </div>
    );
  }

  // ---- Partition args: required vs optional ----

  const requiredArgs = skill.args.filter((a) => a.required);
  const optionalArgs = skill.args.filter((a) => !a.required);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={skill.name}
        description={skill.description}
        breadcrumb={[{ label: "Skills" }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm rounded border border-border text-muted hover:bg-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={hasBlockers || submitting}
              className={[
                "px-4 py-1.5 text-sm rounded font-semibold",
                hasBlockers || submitting
                  ? "bg-surface-2 text-muted cursor-not-allowed"
                  : "bg-accent text-bg-0 hover:opacity-90",
              ].join(" ")}
            >
              {submitting ? "Launching..." : "Launch"}
            </button>
          </div>
        }
      />

      {/* Global blockers */}
      {globalBlockers.length > 0 && (
        <ErrorCard
          title="Cannot launch"
          body={
            <ul className="list-disc list-inside space-y-0.5">
              {globalBlockers.map((b, i) => (
                <li key={`${b.code}-${i}`}>{b.message}</li>
              ))}
            </ul>
          }
        />
      )}

      {/* Required args */}
      {requiredArgs.length > 0 && (
        <div className="space-y-4">
          {requiredArgs.map((arg) => (
            <ArgField
              key={arg.name}
              arg={arg}
              value={formValues[arg.name]}
              onChange={(v) => updateField(arg.name, v)}
              blocker={argBlockerMap.get(arg.name)}
              setSuggestions={arg.type === "set-ref" ? setSuggestions : undefined}
            />
          ))}
        </div>
      )}

      {/* Optional args in a disclosure */}
      {optionalArgs.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted hover:text-fg select-none">
            Show optional inputs ({optionalArgs.length})
          </summary>
          <div className="mt-4 space-y-4">
            {optionalArgs.map((arg) => (
              <ArgField
                key={arg.name}
                arg={arg}
                value={formValues[arg.name]}
                onChange={(v) => updateField(arg.name, v)}
                blocker={argBlockerMap.get(arg.name)}
                setSuggestions={arg.type === "set-ref" ? setSuggestions : undefined}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
