// ---------------------------------------------------------------------------
// Skill Catalog API types -- mirrors backend SkillMetaOut / SkillArgOut shapes
// ---------------------------------------------------------------------------

export type SkillArgType = "string" | "choice" | "bool" | "multi-line" | "set-ref";

export type SkillCategory = "autonomous" | "interactive" | "human-in-loop";

export interface SkillArg {
  name: string;
  type: SkillArgType;
  description: string;
  required: boolean;
  default?: string | boolean | null;
  choices?: string[];
  maxLength?: number;
}

export interface SkillMeta {
  name: string;
  description: string;
  args: SkillArg[];
  categories: SkillCategory[];
  allowedTools: string;
  sourcePath: string;
}

// ---------------------------------------------------------------------------
// Precondition check
// ---------------------------------------------------------------------------

export interface PreconditionBlocker {
  code: string;
  message: string;
  arg?: string;
}

export interface PreconditionCheckResponse {
  ok: boolean;
  blockers: PreconditionBlocker[];
}

// ---------------------------------------------------------------------------
// Gallery filter state
// ---------------------------------------------------------------------------

export interface GalleryFilters {
  categories: Set<SkillCategory>;
  query?: string;
  showAll?: boolean;
}
