import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient, type ApiError } from "@/lib/apiClient";
import type { PreconditionCheckResponse } from "@/types/skills";
import { useDebouncedValue } from "./useDebouncedValue";

export interface UseSkillPreconditionsOpts {
  skillName: string | null;
  projectId: string;
  skillArgs: Record<string, unknown>;
  setId?: string | null;
}

/**
 * Debounced precondition check that re-fires 500ms after `skillArgs` stabilise.
 * Disabled when `skillName` is null.
 */
export function useSkillPreconditions(
  opts: UseSkillPreconditionsOpts,
): UseQueryResult<PreconditionCheckResponse, ApiError> {
  const { skillName, projectId, skillArgs, setId } = opts;
  const argsHash = JSON.stringify(skillArgs);
  const debouncedHash = useDebouncedValue(argsHash, 500);

  return useQuery<PreconditionCheckResponse, ApiError>({
    queryKey: ["preconditions", skillName, debouncedHash, setId ?? null],
    queryFn: () =>
      apiClient.post<PreconditionCheckResponse>(
        `/skills/${skillName}/check-preconditions`,
        { projectId, skillArgs, setId: setId ?? null },
      ),
    enabled: skillName !== null,
  });
}

/**
 * Imperative (non-debounced) precondition check for submit-click validation.
 * Returns the raw response -- caller decides how to handle blockers.
 */
export async function runPreconditionCheck(opts: {
  skillName: string;
  projectId: string;
  skillArgs: Record<string, unknown>;
  setId?: string | null;
}): Promise<PreconditionCheckResponse> {
  const { skillName, projectId, skillArgs, setId } = opts;
  return apiClient.post<PreconditionCheckResponse>(
    `/skills/${skillName}/check-preconditions`,
    { projectId, skillArgs, setId: setId ?? null },
  );
}
