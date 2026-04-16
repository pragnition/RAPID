import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  PageHeader,
  SearchInput,
  SurfaceCard,
  EmptyState,
} from "@/components/primitives";
import type { SkillMeta, SkillCategory, GalleryFilters } from "@/types/skills";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_ORDER: SkillCategory[] = [
  "autonomous",
  "interactive",
  "human-in-loop",
];

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  autonomous: "Autonomous",
  interactive: "Interactive",
  "human-in-loop": "Human-in-loop",
};

/** Primary category = first entry in the skill's categories array. */
function primaryCategory(skill: SkillMeta): SkillCategory {
  return skill.categories[0] ?? "interactive";
}

interface GroupedSkill {
  category: SkillCategory;
  skill: SkillMeta;
}

function buildFlatList(
  skills: SkillMeta[],
  filters: GalleryFilters,
): GroupedSkill[] {
  const categorySet = filters.categories;
  const query = (filters.query ?? "").toLowerCase().trim();

  const filtered = skills.filter((s) => {
    // category filter (unless showAll)
    if (!filters.showAll && categorySet.size > 0) {
      if (!s.categories.some((c) => categorySet.has(c))) return false;
    }
    // text search
    if (query) {
      const haystack = `${s.name} ${s.description}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  // Group by primary category, then sort within group
  const groups = new Map<SkillCategory, SkillMeta[]>();
  for (const cat of CATEGORY_ORDER) groups.set(cat, []);
  for (const s of filtered) {
    const cat = primaryCategory(s);
    const arr = groups.get(cat);
    if (arr) arr.push(s);
    else groups.set(cat, [s]);
  }

  const flat: GroupedSkill[] = [];
  for (const cat of CATEGORY_ORDER) {
    const arr = groups.get(cat);
    if (!arr || arr.length === 0) continue;
    arr.sort((a, b) => a.name.localeCompare(b.name));
    for (const skill of arr) flat.push({ category: cat, skill });
  }
  return flat;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkillGalleryProps {
  skills: SkillMeta[];
  filters: GalleryFilters;
  onFiltersChange?: (f: GalleryFilters) => void;
  onPick: (skill: SkillMeta) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SkillGallery({
  skills,
  filters,
  onFiltersChange,
  onPick,
}: SkillGalleryProps) {
  const flatList = useMemo(() => buildFlatList(skills, filters), [skills, filters]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const gridRef = useRef<HTMLDivElement>(null);

  // Clamp focused index when list shrinks
  const clampedIndex =
    focusedIndex >= flatList.length ? flatList.length - 1 : focusedIndex;

  // ---- Filter toggles ----

  const toggleCategory = useCallback(
    (cat: SkillCategory) => {
      if (!onFiltersChange) return;
      const next = new Set(filters.categories);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      onFiltersChange({ ...filters, categories: next });
    },
    [filters, onFiltersChange],
  );

  const toggleShowAll = useCallback(() => {
    if (!onFiltersChange) return;
    onFiltersChange({ ...filters, showAll: !filters.showAll });
  }, [filters, onFiltersChange]);

  const setQuery = useCallback(
    (q: string) => {
      if (!onFiltersChange) return;
      onFiltersChange({ ...filters, query: q });
    },
    [filters, onFiltersChange],
  );

  // ---- Keyboard nav on grid container ----

  const handleGridKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (flatList.length === 0) return;
      const len = flatList.length;

      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight": {
          e.preventDefault();
          const next = clampedIndex < len - 1 ? clampedIndex + 1 : 0;
          setFocusedIndex(next);
          break;
        }
        case "ArrowUp":
        case "ArrowLeft": {
          e.preventDefault();
          const next = clampedIndex > 0 ? clampedIndex - 1 : len - 1;
          setFocusedIndex(next);
          break;
        }
        case "Enter": {
          e.preventDefault();
          const entry = flatList[clampedIndex >= 0 ? clampedIndex : 0];
          if (entry) onPick(entry.skill);
          break;
        }
      }
    },
    [flatList, clampedIndex, onPick],
  );

  // ---- Render helpers ----

  /** Identify category group boundaries for section headings. */
  function renderCards() {
    const elements: React.ReactNode[] = [];
    let lastCat: SkillCategory | null = null;

    for (let i = 0; i < flatList.length; i++) {
      const { category, skill } = flatList[i]!;

      // Section heading when category changes
      if (category !== lastCat) {
        elements.push(
          <h3
            key={`heading-${category}`}
            className="col-span-full text-xs uppercase tracking-wider text-muted font-semibold mt-4 first:mt-0"
          >
            {CATEGORY_LABEL[category]}
          </h3>,
        );
        lastCat = category;
      }

      const isFocused = i === clampedIndex;
      elements.push(
        <SurfaceCard
          key={skill.name}
          elevation={1}
          className={[
            "p-4 cursor-pointer transition-colors",
            isFocused
              ? "ring-2 ring-accent border-accent"
              : "hover:border-accent/50",
          ].join(" ")}
          onClick={() => onPick(skill)}
        >
          <div className="flex flex-col gap-1.5">
            <h4 className="text-sm font-bold text-fg truncate">{skill.name}</h4>
            <p className="text-xs text-muted line-clamp-2">{skill.description}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[11px] text-muted">
                {skill.args.length} arg{skill.args.length !== 1 ? "s" : ""}
              </span>
              {skill.categories.map((c) => (
                <span
                  key={c}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted uppercase tracking-wider"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </SurfaceCard>,
      );
    }
    return elements;
  }

  // ---- Main render ----

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Skills"
        description={`${skills.length} skill${skills.length !== 1 ? "s" : ""} available`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORY_ORDER.map((cat) => {
              const active = filters.showAll || filters.categories.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={[
                    "px-2.5 py-1 text-xs rounded border transition-colors",
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted hover:bg-hover",
                  ].join(" ")}
                >
                  {CATEGORY_LABEL[cat]}
                </button>
              );
            })}
            <button
              type="button"
              onClick={toggleShowAll}
              className={[
                "px-2.5 py-1 text-xs rounded border transition-colors",
                filters.showAll
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:bg-hover",
              ].join(" ")}
            >
              All skills
            </button>
          </div>
        }
      />

      {onFiltersChange && (
        <SearchInput
          value={filters.query ?? ""}
          onChange={setQuery}
          placeholder="Filter skills..."
          aria-label="Filter skills"
        />
      )}

      {flatList.length === 0 ? (
        <EmptyState
          title="No skills match these filters"
          description="Try toggling 'All skills' to widen the view."
        />
      ) : (
        <div
          ref={gridRef}
          role="grid"
          tabIndex={0}
          onKeyDown={handleGridKeyDown}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 outline-none"
        >
          {renderCards()}
        </div>
      )}
    </div>
  );
}
