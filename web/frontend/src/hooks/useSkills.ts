import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient, type ApiError } from "@/lib/apiClient";
import type { SkillMeta } from "@/types/skills";

/**
 * Fetch the full skill catalog (sorted by name, server-side).
 * Stale after 60s -- skills change infrequently during a session.
 */
export function useSkills(): UseQueryResult<SkillMeta[], ApiError> {
  return useQuery<SkillMeta[], ApiError>({
    queryKey: ["skills"],
    queryFn: () => apiClient.get<SkillMeta[]>("/skills"),
    staleTime: 60_000,
  });
}

/**
 * Fetch a single skill by name.  Disabled when `name` is null (no skill selected).
 */
export function useSkill(
  name: string | null,
): UseQueryResult<SkillMeta, ApiError> {
  return useQuery<SkillMeta, ApiError>({
    queryKey: ["skills", name],
    queryFn: () => apiClient.get<SkillMeta>(`/skills/${name}`),
    enabled: name !== null,
  });
}
