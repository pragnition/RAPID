# Phase 39: Documentation Refresh - Research

**Researched:** 2026-03-12
**Domain:** Documentation accuracy -- updating README.md and docs/planning.md to reflect post-37.1 interface changes
**Confidence:** HIGH

## Summary

Phase 39 is a targeted documentation fix phase. Phase 37.1 introduced two breaking interface changes: (1) `/rapid:discuss` changed from wave-level `<wave-id>` argument to set-level `<set-id>` argument with single-round discussion instead of 2-round, and (2) `/rapid:plan-set` was renamed to `/rapid:plan` (overloading the existing `/rapid:plan` command name, which now serves dual purpose via the `plan-set` skill). These changes left both `README.md` and `docs/planning.md` stale.

The v2.2 Milestone Audit (`.planning/v2.2-MILESTONE-AUDIT.md`) identified these as the two remaining unsatisfied requirements: DOC-01 (README command reference stale) and DOC-03 (docs/planning.md stale). Phase 38 fixed the underlying code issues (display stage maps, quick flag parsing, migrate Step 7). This phase fixes only the documentation.

**Primary recommendation:** This is a surgical text-editing phase. No code changes, no library research, no architecture decisions. Apply targeted edits to exactly 2 files (README.md, docs/planning.md) based on the audit's line-level guidance and the current SKILL.md source-of-truth files.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | README.md rewritten from scratch reflecting all capabilities through v2.2 with accurate command reference | Audit identified exact stale lines (134-135, 200, 203). Current SKILL.md files provide authoritative interface definitions. |
| DOC-03 | technical_documentation.md created as power user reference with all skills, configuration, and state machine documentation | Audit identified exact stale section (docs/planning.md lines 19-35). Current discuss and plan-set SKILL.md files provide authoritative interface definitions. |
</phase_requirements>

## Standard Stack

Not applicable -- this phase involves only Markdown text edits. No libraries, frameworks, or code changes.

## Architecture Patterns

### Files to Edit

```
README.md                # DOC-01: command reference and quick start
docs/planning.md         # DOC-03: discuss and plan-set entries
```

### Source-of-Truth Files (read-only reference)

```
skills/discuss/SKILL.md         # Current discuss interface (set-level, single-round)
skills/plan-set/SKILL.md        # Current plan-set interface (renamed to /rapid:plan)
skills/plan/SKILL.md            # Project decomposition /rapid:plan (unchanged)
skills/wave-plan/SKILL.md       # Internal skill (not user-facing)
.planning/v2.2-MILESTONE-AUDIT.md  # Exact gap descriptions with line numbers
```

### Pattern: Diff-Based Documentation Fix

**What:** Apply targeted text replacements to specific lines/sections, verified against current SKILL.md source-of-truth.
**When to use:** When documentation is stale due to interface changes in a prior phase.

### Anti-Patterns to Avoid

- **Full rewrite of README or docs/planning.md:** These files were carefully written in Phases 36 and 37. Only the stale sections need updating.
- **Changing the wave-plan or plan-set skill directories/files:** Those are implementation concerns outside documentation scope.
- **Updating technical_documentation.md index:** It merely links to docs/planning.md, which is what gets edited.

## Don't Hand-Roll

Not applicable -- no code is involved in this phase.

## Common Pitfalls

### Pitfall 1: Overwriting correct content while editing stale sections
**What goes wrong:** README.md is 226 lines with many sections. Editing the discuss entry at line 134 could accidentally corrupt adjacent sections.
**Why it happens:** README uses a mix of inline code, tables, and collapsible details blocks.
**How to avoid:** Use targeted edits (Edit tool, not Write tool) to change only specific lines. Verify surrounding content is preserved.
**Warning signs:** Post-edit line count differs significantly from pre-edit count.

### Pitfall 2: Inconsistency between sections within the same file
**What goes wrong:** README.md mentions discuss and plan-set in multiple places (quick start section, per-set development section, command reference table, notes section). Fixing one mention but missing another leaves the file internally inconsistent.
**Why it happens:** Commands are referenced in narrative text, code examples, and reference tables.
**How to avoid:** Search for ALL occurrences of `discuss`, `wave-id`, `plan-set`, and `wave-plan` in each file before editing.
**Warning signs:** Grep for old patterns still returns matches after edits.

### Pitfall 3: Getting the `/rapid:plan` dual-use wrong
**What goes wrong:** `/rapid:plan` now serves two purposes: (1) project decomposition into sets (skills/plan/SKILL.md) and (2) planning all waves in a set (skills/plan-set/SKILL.md, formerly `/rapid:plan-set`). Documentation could conflate these.
**Why it happens:** The rename overloaded an existing command name. The two uses are distinguished by whether an argument is provided (`/rapid:plan` alone = decomposition; `/rapid:plan <set-id>` = wave planning).
**How to avoid:** Clearly document both forms: `/rapid:plan` (no args) for decomposition, `/rapid:plan <set-id>` for set-level wave planning. The command reference table should merge these into one row with "(none) or <set-id>" in the Arguments column.
**Warning signs:** Two separate rows for `/rapid:plan` in the command table.

### Pitfall 4: Describing discuss as still having wave-level features
**What goes wrong:** Old docs describe discuss with `<wave-id>` argument, "5-8 gray areas", "2-round conversation (approach selection followed by specifics confirmation)". The new interface is completely different.
**Why it happens:** The old description is detailed and specific -- easy to half-update.
**How to avoid:** Rewrite the discuss section from scratch based on the current SKILL.md. Key changes: accepts `<set-id>` not `<wave-id>`, flexible gray area count (not fixed 5-8), single-round one-question-per-area (not 2-round), outputs per-wave WAVE-CONTEXT.md files.

## Code Examples

No code examples needed -- this is a Markdown editing phase.

### README.md: Specific Changes Required

**Line 134 (Per-Set Development, Step 2):** Currently reads:
```markdown
2. **`/rapid:discuss <wave-id>`** -- Structured discussion about a wave's
   implementation approach. Surfaces gray areas and assumptions, lets you make design
   decisions before autonomous planning begins. Run once per wave.
```
Must become:
```markdown
2. **`/rapid:discuss <set-id>`** -- Structured discussion about a set's
   implementation approach. Identifies product and UX gray areas across all waves,
   conducts a single-round discussion (one question per area), and splits decisions
   into per-wave WAVE-CONTEXT.md files. Run once per set.
```

**Lines 138-145 (Per-Set Development, Steps 3-4):** Currently lists wave-plan as step 3 with plan-set as an alternative. Must restructure: `/rapid:plan <set-id>` as the primary step 3 (replaces both wave-plan user-facing and plan-set). Remove the wave-plan user-facing reference since wave-plan is now internal-only.

**Line 200 (Command Reference Table):** Remove the `/rapid:plan-set` row entirely. Merge its functionality into the existing `/rapid:plan` row by changing Arguments from `_(none)_` to `_(none)_ or <set-id>` and updating the Description to cover both decomposition and set-level planning.

**Line 203 (Command Reference Table):** Change `/rapid:discuss` arguments from `<wave-id> or <set-id> <wave-id>` to `<set-id>`.

**Line 204 (Command Reference Table):** Remove the `/rapid:wave-plan` row (it is now internal-only).

**Line 217 (Notes section):** Remove or update the bullet about `<wave-id>` dot notation for wave-plan since wave-plan is no longer user-facing.

### docs/planning.md: Specific Changes Required

**Lines 19-24 (Discuss section header and body):** Currently reads:
```markdown
## `/rapid:discuss <wave-id>` or `<set-id> <wave-id>`

Captures implementation vision for a wave before autonomous planning begins. Reads the set's CONTRACT.json, DEFINITION.md, and SET-OVERVIEW.md, then identifies 5-8 gray areas where multiple valid approaches exist. You select which areas to discuss, then a structured 2-round conversation (approach selection followed by specifics confirmation) locks decisions for each. Decisions and Claude's discretion areas are written to WAVE-CONTEXT.md. Supports "Let Claude decide all" for full delegation.
```
Must become (based on current SKILL.md):
```markdown
## `/rapid:discuss <set-id>`

Captures implementation vision for an entire set before autonomous planning begins. Reads the set's CONTRACT.json, DEFINITION.md, SET-OVERVIEW.md, and per-wave artifacts, then identifies product and UX gray areas across all waves. A single-round discussion asks one question per area with concrete options. Decisions are split into per-wave WAVE-CONTEXT.md files based on relevance. Supports "Revise" to re-identify areas if the developer wants changes.
```

**Lines 31-35 (Plan-set section):** Currently a separate `## /rapid:plan-set <set-id>` section. Must be merged into the existing `## /rapid:plan` section (lines 7-11). The merged section should describe both uses: (1) `/rapid:plan` with no arguments for project decomposition into sets, and (2) `/rapid:plan <set-id>` for planning all waves in a set.

**Wave-plan section (lines 25-29):** Add a note that wave-plan is internal-only, invoked by `/rapid:plan <set-id>`, and not called directly by users. Or remove from the planning docs entirely with a brief note that wave planning is handled internally by `/rapid:plan <set-id>`.

## State of the Art

| Old Interface (Pre-37.1) | Current Interface (Post-37.1) | Changed In | Impact on Docs |
|---------------------------|-------------------------------|------------|----------------|
| `/rapid:discuss <wave-id>` | `/rapid:discuss <set-id>` | Phase 37.1-02 (FIX-02) | README lines 134, 203, 217; docs/planning.md lines 19-24 |
| 2-round discussion per wave | Single-round discussion per set | Phase 37.1-02 (FIX-02) | README line 135; docs/planning.md lines 20-22 |
| `/rapid:plan-set <set-id>` (separate command) | `/rapid:plan <set-id>` (merged into plan) | Phase 37.1-03 (FIX-01) | README lines 143-145, 200; docs/planning.md lines 31-35 |
| `/rapid:wave-plan` (user-facing) | `/rapid:wave-plan` (internal-only) | Phase 37.1-03 (FIX-01) | README line 204; docs/planning.md lines 25-29 |

## Open Questions

1. **Should wave-plan be removed from docs/planning.md entirely or kept with "internal" label?**
   - What we know: wave-plan SKILL.md line 6 says "> **Internal skill.** This is invoked programmatically by `/rapid:plan` (plan-set). Users should not call this directly."
   - Recommendation: Keep a brief entry with "Internal" note for completeness (power users may want to understand the pipeline), but remove from README command reference (which is user-facing). This aligns with Phase 37 decisions about documenting internal agents for power users.

2. **Should the README Notes section about dot-notation for wave-id be removed?**
   - What we know: Dot notation (`1.1` for set 1, wave 1) was used by `/rapid:wave-plan` and `/rapid:discuss` (old interface). Now discuss only takes set-id, and wave-plan is internal.
   - Recommendation: Remove the wave-id dot notation note from the Notes section. Only the set-id numeric index note is still relevant.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | None (convention-based) |
| Quick run command | `node --test src/lib/*.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs src/bin/*.test.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | README.md command reference accuracy | manual-only | N/A | N/A |
| DOC-03 | docs/planning.md interface accuracy | manual-only | N/A | N/A |

**Manual-only justification:** These requirements are documentation-text-only changes to Markdown files. The verification is visual/textual: confirm that stale references to `<wave-id>`, `/rapid:plan-set`, and 2-round discussion are replaced with correct current references. No code is changed, no functions are modified, no behavior changes. Automated testing would require a documentation linter or regex-based grep checks, which is overkill for a 2-file, 6-section targeted edit.

### Sampling Rate
- **Per task commit:** Grep verification: `grep -n "plan-set\|wave-id\|2-round\|5-8 gray" README.md docs/planning.md` should return zero matches
- **Phase gate:** Manual review of both files confirming all 3 success criteria from the ROADMAP

### Wave 0 Gaps

None -- no test infrastructure needed. This is a documentation-only phase with grep-based verification.

## Sources

### Primary (HIGH confidence)
- `skills/discuss/SKILL.md` -- current authoritative interface for discuss command (set-level, single-round, `<set-id>` argument)
- `skills/plan-set/SKILL.md` -- current authoritative interface for plan-set (renamed to `/rapid:plan <set-id>`)
- `skills/plan/SKILL.md` -- current authoritative interface for project decomposition (`/rapid:plan` no args)
- `skills/wave-plan/SKILL.md` -- confirms wave-plan is internal-only (line 6: "Internal skill")
- `.planning/v2.2-MILESTONE-AUDIT.md` -- exact gap descriptions with line numbers and file references

### Secondary (MEDIUM confidence)
- None needed -- all sources are internal project files with direct inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no stack involved, pure documentation edits
- Architecture: HIGH -- exact files, line numbers, and replacement text identified from SKILL.md source-of-truth
- Pitfalls: HIGH -- all pitfalls are structural (multiple mentions, section adjacency) verified by grep

**Research date:** 2026-03-12
**Valid until:** Indefinite (documentation of completed interface changes -- no moving target)
