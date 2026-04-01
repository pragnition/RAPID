# Quick Plan 8: Roadmapper Set Naming and Foundation Reservation

## Objective

Fix two issues in the roadmapper role module (`src/modules/roles/role-roadmapper.md`):

1. The roadmapper generates set IDs like "A", "B", "C" or "1", "2", "3" instead of descriptive kebab-case slugs. Set IDs become branch names (`set/[id]`) and directory paths (`.planning/sets/[id]/`), so they must be descriptive and filesystem-safe.
2. The roadmapper confuses the RAPID "foundation" set concept (a reserved multi-developer interface stub set) with a project's "foundation" meaning (core/base logic). Regular feature sets must never use "foundation" as their ID.

## Task 1: Add set naming convention to role module

**Files:** `src/modules/roles/role-roadmapper.md`

**Action:** Add a new `### Set Naming Convention` subsection inside the `## Design Principles` section (after the existing `### Set Boundary Design` subsection, before `### Wave Ordering`). The new subsection must contain:

- Set IDs MUST be descriptive kebab-case slugs (lowercase letters, numbers, hyphens only)
- Set IDs are used for branch names (`set/[id]`) and directory names (`.planning/sets/[id]/`), so they must be filesystem-safe and human-readable
- Good examples: `auth-system`, `hud-game-controls`, `data-pipeline`, `api-endpoints`, `polish-end-game`
- Bad examples (explicitly forbidden): single letters (`A`, `B`, `C`), plain numbers (`1`, `2`, `3`), generic names (`set-1`, `group-a`, `phase-1`), overly terse names (`ui`, `db`)
- The name should describe the feature or domain the set covers, not its position in a sequence
- Format constraint: `/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/` (3-40 chars, starts with letter, ends with letter or digit, kebab-case)

Also update the `[set-id]` placeholder references in the Output section's JSON examples and ROADMAP.md template to include a brief inline comment or note reinforcing the kebab-case convention (e.g., change `"id": "[set-id]"` comment to `// kebab-case slug, e.g. "auth-system"`).

**Verification:**
```bash
grep -c "kebab-case" src/modules/roles/role-roadmapper.md
# Expected: >= 2 (the convention section + at least one inline reference)
grep "Set Naming Convention" src/modules/roles/role-roadmapper.md
# Expected: prints the subsection header
grep -P "auth-system|hud-game-controls|data-pipeline" src/modules/roles/role-roadmapper.md
# Expected: prints example lines
```

**Done when:** The role module contains a `### Set Naming Convention` subsection with explicit rules, examples, forbidden patterns, and a regex constraint.

---

## Task 2: Clarify "foundation" as a reserved set ID

**Files:** `src/modules/roles/role-roadmapper.md`

**Action:** Add a reservation/prohibition notice in two locations:

**Location A -- Inside the new `### Set Naming Convention` subsection (from Task 1):**
Add a "Reserved IDs" bullet or sub-block stating:
- `foundation` is a **reserved** set ID. It is used exclusively for the multi-developer interface stub set (team-size > 1).
- Regular feature sets MUST NOT use `foundation` as their ID or name, even if the set represents "base", "core", or "foundational" functionality. Use descriptive names like `core-engine`, `game-logic`, `base-api` instead.
- When `team-size = 1`, the word "foundation" must not appear in any set ID or name.

**Location B -- Inside the existing `## Foundation Set (Multi-Developer Only)` section:**
Add a warning block at the top of that section (right after the opening paragraph, before `### Foundation Set in state.milestones[].sets[]`) stating:
- **IMPORTANT:** `foundation` is a reserved set ID. It MUST NOT be used for regular feature sets. The foundation set is exclusively for shared interface stubs in multi-developer mode. If a project has a "foundation" or "core" feature area, use a descriptive ID like `core-engine`, `base-systems`, or `game-logic` -- never `foundation`.

**Verification:**
```bash
grep -c "reserved" src/modules/roles/role-roadmapper.md
# Expected: >= 2 (one in naming convention, one in foundation section)
grep "MUST NOT.*foundation" src/modules/roles/role-roadmapper.md
# Expected: prints prohibition lines
grep -c "core-engine" src/modules/roles/role-roadmapper.md
# Expected: >= 2 (appears in both locations as an alternative example)
```

**Done when:** Both the naming convention section and the foundation set section explicitly state that "foundation" is reserved and provide alternative names for core/base feature sets.

---

## Task 3: Recompile agents and verify

**Files:** `agents/rapid-roadmapper.md` (output, not manually edited)

**Action:** Run the agent compiler to regenerate the compiled agent from the updated role module.

```bash
node src/bin/rapid-tools.cjs build-agents
```

**Verification:**
```bash
# Verify the compiled agent contains the new naming convention
grep "Set Naming Convention" agents/rapid-roadmapper.md
# Expected: prints the subsection header

# Verify the compiled agent contains the reservation notice
grep "reserved" agents/rapid-roadmapper.md
# Expected: prints reservation lines

# Verify the compiled agent contains kebab-case examples
grep "auth-system" agents/rapid-roadmapper.md
# Expected: prints example lines

# Verify no stale content (compiled should match source role)
diff <(sed -n '/<role>/,/<\/role>/p' agents/rapid-roadmapper.md | head -5) /dev/null || true
# Just confirm the role section exists in the compiled output
```

**Done when:** `agents/rapid-roadmapper.md` contains all changes from Tasks 1-2, confirmed by grep checks above.

---

## Summary

| Task | Files | Action |
|------|-------|--------|
| 1 | `src/modules/roles/role-roadmapper.md` | Add `### Set Naming Convention` with kebab-case rules, examples, and regex |
| 2 | `src/modules/roles/role-roadmapper.md` | Add "foundation" reservation notices in naming convention + foundation section |
| 3 | `agents/rapid-roadmapper.md` | Recompile via `build-agents` and verify |
