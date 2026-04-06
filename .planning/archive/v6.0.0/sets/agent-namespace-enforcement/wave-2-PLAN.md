# PLAN: agent-namespace-enforcement -- Wave 2

## Objective

Sweep all role module files under `src/modules/roles/` and fix informal agent references that lack the proper `rapid-` prefix. This enforces the naming convention established in Wave 1's updated Namespace Isolation section and models correct behavior for agents reading these prompts.

## Owned Files

| File | Action | Edit Count |
|------|--------|------------|
| `src/modules/roles/role-research-stack.md` | Modify | 5 |
| `src/modules/roles/role-research-features.md` | Modify | 6 |
| `src/modules/roles/role-research-architecture.md` | Modify | 5 |
| `src/modules/roles/role-research-pitfalls.md` | Modify | 5 |
| `src/modules/roles/role-research-oversights.md` | Modify | 5 |
| `src/modules/roles/role-research-ux.md` | Modify | 6 |
| `src/modules/roles/role-research-synthesizer.md` | Modify | 4 |
| `src/modules/roles/role-bugfix.md` | Modify | 2 |
| `src/modules/roles/role-judge.md` | Modify | 1 |
| `src/modules/roles/role-merger.md` | Modify | 1 |

**Files NOT modified (no violations found):**
- `role-executor.md`, `role-planner.md`, `role-reviewer.md`, `role-verifier.md`
- `role-codebase-synthesizer.md`, `role-set-planner.md`, `role-devils-advocate.md`
- `role-context-generator.md`, `role-bug-hunter.md`, `role-unit-tester.md`
- `role-scoper.md`, `role-plan-verifier.md`, `role-branding.md`
- `role-conflict-resolver.md`, `role-set-merger.md`, `role-auditor.md`
- `role-uat.md`, `role-roadmapper.md`

## Tasks

### Task 1: Fix 6 research role files -- pipeline handoff + scope boundary references

These 6 files all share the same pattern: line 3 says "the synthesizer agent" and the "What This Agent Does NOT Do" section references other research agents by informal name.

**For each file, apply ALL of the following edits:**

#### 1a. `src/modules/roles/role-research-stack.md`

| Line | Old Text | New Text |
|------|----------|----------|
| 3 | `the synthesizer agent` | `the \`rapid-research-synthesizer\` agent` |
| 107 | `(that is the Features agent)` | `(that is the \`rapid-research-features\` agent)` |
| 108 | `(that is the Architecture agent)` | `(that is the \`rapid-research-architecture\` agent)` |
| 109 | `(that is the Pitfalls agent)` | `(that is the \`rapid-research-pitfalls\` agent)` |
| 110 | `(that is the Oversights agent)` | `(that is the \`rapid-research-oversights\` agent)` |
| 113 | `for the synthesizer` | `for the \`rapid-research-synthesizer\`` |

#### 1b. `src/modules/roles/role-research-features.md`

| Line | Old Text | New Text |
|------|----------|----------|
| 3 | `the synthesizer agent` | `the \`rapid-research-synthesizer\` agent` |
| 122 | `(that is the Stack agent)` | `(that is the \`rapid-research-stack\` agent)` |
| 123 | `(that is the Architecture agent)` | `(that is the \`rapid-research-architecture\` agent)` |
| 124 | `(that is the Pitfalls agent)` | `(that is the \`rapid-research-pitfalls\` agent)` |
| 125 | `(that is the Oversights agent)` | `(that is the \`rapid-research-oversights\` agent)` |
| 127 | `for the synthesizer` | `for the \`rapid-research-synthesizer\`` |

#### 1c. `src/modules/roles/role-research-architecture.md`

| Line | Old Text | New Text |
|------|----------|----------|
| 3 | `the synthesizer agent` | `the \`rapid-research-synthesizer\` agent` |
| 135 | `(that is the Features agent)` | `(that is the \`rapid-research-features\` agent)` |
| 136 | `(that is the Stack agent)` | `(that is the \`rapid-research-stack\` agent)` |
| 137 | `(that is the Pitfalls agent)` | `(that is the \`rapid-research-pitfalls\` agent)` |
| 138 | `(that is the Oversights agent)` | `(that is the \`rapid-research-oversights\` agent)` |

#### 1d. `src/modules/roles/role-research-pitfalls.md`

| Line | Old Text | New Text |
|------|----------|----------|
| 3 | `the synthesizer agent` | `the \`rapid-research-synthesizer\` agent` |
| 118 | `(that is the Oversights agent)` | `(that is the \`rapid-research-oversights\` agent)` |
| 119 | `(that is the Features agent)` | `(that is the \`rapid-research-features\` agent)` |
| 120 | `(that is the Architecture agent)` | `(that is the \`rapid-research-architecture\` agent)` |
| 121 | `(that is the Stack agent)` | `(that is the \`rapid-research-stack\` agent)` |

#### 1e. `src/modules/roles/role-research-oversights.md`

| Line | Old Text | New Text |
|------|----------|----------|
| 3 | `the synthesizer agent` | `the \`rapid-research-synthesizer\` agent` |
| 140 | `(that is the Features agent)` | `(that is the \`rapid-research-features\` agent)` |
| 141 | `(that is the Architecture agent)` | `(that is the \`rapid-research-architecture\` agent)` |
| 142 | `(that is the Pitfalls agent)` | `(that is the \`rapid-research-pitfalls\` agent)` |
| 143 | `(that is the Stack agent)` | `(that is the \`rapid-research-stack\` agent)` |

#### 1f. `src/modules/roles/role-research-ux.md`

| Line | Old Text | New Text |
|------|----------|----------|
| 3 | `the synthesizer agent` | `the \`rapid-research-synthesizer\` agent` |
| 102 | `(that is the Stack agent)` | `(that is the \`rapid-research-stack\` agent)` |
| 103 | `(that is the Features agent)` | `(that is the \`rapid-research-features\` agent)` |
| 104 | `(that is the Architecture agent)` | `(that is the \`rapid-research-architecture\` agent)` |
| 105 | `(that is the Pitfalls agent)` | `(that is the \`rapid-research-pitfalls\` agent)` |
| 106 | `(that is the Oversights agent)` | `(that is the \`rapid-research-oversights\` agent)` |
| 109 | `for the synthesizer` | `for the \`rapid-research-synthesizer\`` |

**Verification for Task 1:**
```bash
# Should return 0 matches -- all informal agent names should be gone
grep -rn "that is the \(Features\|Architecture\|Pitfalls\|Oversights\|Stack\) agent" src/modules/roles/
# Should return 0 matches -- all "the synthesizer agent" should be prefixed now
grep -rn "the synthesizer agent" src/modules/roles/
# Should return 0 matches -- all "for the synthesizer" without prefix should be gone
grep -rn "for the synthesizer$" src/modules/roles/
```

### Task 2: Fix research-synthesizer -- roadmapper references

**File:** `src/modules/roles/role-research-synthesizer.md`

| Line | Old Text | New Text |
|------|----------|----------|
| 3 | `the roadmapper agent` | `the \`rapid-roadmapper\` agent` |
| 101 | `the roadmapper agent will use` | `the \`rapid-roadmapper\` agent will use` |
| 107 | `for the roadmapper` | `for the \`rapid-roadmapper\`` |
| 127 | `for the roadmapper agent` | `for the \`rapid-roadmapper\` agent` |

**Verification:**
```bash
# Should return 0 matches for unprefixed roadmapper references
grep -n "the roadmapper agent" src/modules/roles/role-research-synthesizer.md
grep -n "for the roadmapper" src/modules/roles/role-research-synthesizer.md
```

### Task 3: Fix role-judge.md and role-merger.md -- bugfix/executor references

**File:** `src/modules/roles/role-judge.md`

| Line | Old Text | New Text |
|------|----------|----------|
| 9 | `for the bugfix agent` | `for the \`rapid-bugfix\` agent` |

**File:** `src/modules/roles/role-merger.md`

| Line | Old Text | New Text |
|------|----------|----------|
| 124 | `The bugfix or executor agent` | `The \`rapid-bugfix\` or \`rapid-executor\` agent` |

**Verification:**
```bash
grep -n "the bugfix agent" src/modules/roles/role-judge.md
grep -n "bugfix or executor agent" src/modules/roles/role-merger.md
# Both should return 0 matches
```

### Task 4: Fix role-bugfix.md -- judge references

**File:** `src/modules/roles/role-bugfix.md`

| Line | Old Text | New Text |
|------|----------|----------|
| 17 | `rulings from the judge` | `rulings from the \`rapid-judge\`` |
| 67 | `from the judge's ruling` | `from the \`rapid-judge\`'s ruling` |

**Verification:**
```bash
grep -n "from the judge" src/modules/roles/role-bugfix.md
# Should return 0 matches
```

### Task 5: Full sweep verification

After all edits, run a comprehensive check to confirm no informal agent references remain.

```bash
# Comprehensive sweep -- should return 0 results for each
grep -rn "the synthesizer agent" src/modules/roles/
grep -rn "the roadmapper agent" src/modules/roles/
grep -rn "the bugfix agent" src/modules/roles/
grep -rn "the executor agent" src/modules/roles/
grep -rn "the judge's\|from the judge" src/modules/roles/
grep -rn "that is the [A-Z][a-z]* agent" src/modules/roles/
grep -rn "for the synthesizer$\|for the roadmapper$" src/modules/roles/

# Positive check -- confirm prefixed references exist
grep -rn "rapid-research-synthesizer" src/modules/roles/ | wc -l
# Expected: ~15+ matches across files
grep -rn "rapid-roadmapper" src/modules/roles/ | wc -l
# Expected: 4 matches in role-research-synthesizer.md
```

## Success Criteria

1. Zero informal agent references remain in any `src/modules/roles/role-*.md` file
2. All agent references use the full `rapid-` prefixed name in backtick formatting
3. No files outside the owned file list are modified
4. All 10 files pass Markdown lint (no broken formatting)
5. Total of 43 individual text replacements applied across 10 files
