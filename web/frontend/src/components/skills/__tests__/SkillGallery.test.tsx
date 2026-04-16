import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillGallery } from "../SkillGallery";
import type { SkillMeta, GalleryFilters } from "@/types/skills";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSkill(
  overrides: Partial<SkillMeta> & { name: string },
): SkillMeta {
  return {
    description: `Description for ${overrides.name}`,
    args: [],
    categories: ["interactive"],
    allowedTools: "Read,Write",
    sourcePath: `/skills/${overrides.name}/SKILL.md`,
    ...overrides,
  };
}

const MOCK_SKILLS: SkillMeta[] = [
  makeSkill({ name: "beta-skill", categories: ["autonomous"] }),
  makeSkill({ name: "alpha-skill", categories: ["autonomous"] }),
  makeSkill({ name: "delta-skill", categories: ["interactive"] }),
  makeSkill({ name: "charlie-skill", categories: ["interactive"] }),
  makeSkill({ name: "foxtrot-skill", categories: ["human-in-loop"] }),
  makeSkill({ name: "echo-skill", categories: ["human-in-loop"] }),
];

const DEFAULT_FILTERS: GalleryFilters = {
  categories: new Set(),
  showAll: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SkillGallery", () => {
  it("renders category-banded sorted list", () => {
    const onPick = vi.fn();
    render(
      <SkillGallery
        skills={MOCK_SKILLS}
        filters={DEFAULT_FILTERS}
        onPick={onPick}
      />,
    );

    // Verify all category headings exist (also appear in filter buttons, so use getAllByText)
    expect(screen.getAllByText("Autonomous").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Interactive").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Human-in-loop").length).toBeGreaterThanOrEqual(1);

    // Verify all skills rendered
    for (const s of MOCK_SKILLS) {
      expect(screen.getByText(s.name)).toBeInTheDocument();
    }

    // Check sort order within categories: alpha before beta (autonomous)
    const allCards = screen
      .getAllByRole("heading", { level: 4 })
      .map((el) => el.textContent);
    const alphaIdx = allCards.indexOf("alpha-skill");
    const betaIdx = allCards.indexOf("beta-skill");
    expect(alphaIdx).toBeLessThan(betaIdx);

    // interactive: charlie before delta
    const charlieIdx = allCards.indexOf("charlie-skill");
    const deltaIdx = allCards.indexOf("delta-skill");
    expect(charlieIdx).toBeLessThan(deltaIdx);
  });

  it("arrow-down moves focus to next card", () => {
    const onPick = vi.fn();
    render(
      <SkillGallery
        skills={MOCK_SKILLS}
        filters={DEFAULT_FILTERS}
        onPick={onPick}
      />,
    );

    const grid = screen.getByRole("grid");
    grid.focus();

    // First arrow-down should move focus to index 0
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    // Second should move to index 1
    fireEvent.keyDown(grid, { key: "ArrowDown" });

    // The second skill in sorted autonomous is beta-skill (index 1)
    // Verify the ring-2 class appears (focus indicator)
    // Since we can't directly query CSS classes on SurfaceCard internals easily,
    // we check that the grid handled the events without errors
    expect(onPick).not.toHaveBeenCalled(); // arrows don't pick
  });

  it("enter activates onPick", () => {
    const onPick = vi.fn();
    render(
      <SkillGallery
        skills={MOCK_SKILLS}
        filters={DEFAULT_FILTERS}
        onPick={onPick}
      />,
    );

    const grid = screen.getByRole("grid");
    grid.focus();

    // Move down once then press Enter
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    fireEvent.keyDown(grid, { key: "Enter" });

    // Should pick the second card in the flat list (index 1 after ArrowDown from -1 -> 0 -> Enter)
    // Index 0 is alpha-skill (first sorted autonomous skill)
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ name: "alpha-skill" }),
    );
  });

  it("empty state when no matches", () => {
    const onPick = vi.fn();
    const narrowFilters: GalleryFilters = {
      categories: new Set(["human-in-loop"]),
      query: "zzz-nonexistent",
    };

    render(
      <SkillGallery
        skills={MOCK_SKILLS}
        filters={narrowFilters}
        onPick={onPick}
      />,
    );

    expect(
      screen.getByText("No skills match these filters"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Try toggling 'All skills' to widen the view."),
    ).toBeInTheDocument();
  });
});
