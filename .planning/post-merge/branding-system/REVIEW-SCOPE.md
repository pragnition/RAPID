# REVIEW-SCOPE: branding-system

<!-- SCOPE-META {"setId":"branding-system","date":"2026-03-20T07:00:00.000Z","postMerge":true,"worktreePath":"/home/kek/Projects/RAPID","totalFiles":14,"useConcernScoping":true} -->

## Set Metadata
| Field | Value |
|-------|-------|
| Set ID | branding-system |
| Date | 2026-03-20T07:00:00.000Z |
| Post-Merge | true |
| Worktree Path | /home/kek/Projects/RAPID |
| Total Files | 14 |
| Concern Scoping | true |

## Changed Files
| File | Wave Attribution |
|------|-----------------|
| `skills/branding/SKILL.md` | unattributed |
| `src/lib/display.cjs` | unattributed |
| `src/lib/display.test.cjs` | unattributed |
| `src/lib/execute.cjs` | unattributed |
| `src/lib/execute.test.cjs` | unattributed |
| `src/modules/roles/role-branding.md` | unattributed |

## Dependent Files
| File |
|------|
| `src/commands/commands.test.cjs` |
| `src/commands/display.cjs` |
| `src/commands/execute.cjs` |
| `src/commands/misc.cjs` |
| `src/commands/ui-contract.test.cjs` |
| `src/lib/compaction.test.cjs` |
| `src/lib/merge.cjs` |
| `src/lib/review.cjs` |

## Directory Chunks
### Chunk 1: .
- `skills/branding/SKILL.md`
- `src/lib/display.cjs`
- `src/lib/display.test.cjs`
- `src/lib/execute.cjs`
- `src/lib/execute.test.cjs`
- `src/modules/roles/role-branding.md`
- `src/commands/commands.test.cjs`
- `src/commands/display.cjs`
- `src/commands/execute.cjs`
- `src/commands/misc.cjs`
- `src/commands/ui-contract.test.cjs`
- `src/lib/compaction.test.cjs`
- `src/lib/merge.cjs`
- `src/lib/review.cjs`

## Wave Attribution
| File | Wave |
|------|------|
| `skills/branding/SKILL.md` | unattributed |
| `src/lib/display.cjs` | unattributed |
| `src/lib/display.test.cjs` | unattributed |
| `src/lib/execute.cjs` | unattributed |
| `src/lib/execute.test.cjs` | unattributed |
| `src/modules/roles/role-branding.md` | unattributed |

## Concern Scoping

### Concern 1: branding-skill-definition (2 files)
Branding interview skill and agent role module defining the user-facing branding workflow.
- `skills/branding/SKILL.md`
- `src/modules/roles/role-branding.md`

### Concern 2: branding-context-injection (2 files)
Core execution engine changes that read BRANDING.md and inject branding context into agent prompts.
- `src/lib/execute.cjs`
- `src/commands/execute.cjs`

### Concern 3: branding-context-tests (1 file)
Comprehensive test suite for branding context building and injection.
- `src/lib/execute.test.cjs`

### Concern 4: display-branding-stage (3 files)
Addition of branding stage to display library stage maps and banner rendering.
- `src/lib/display.cjs`
- `src/lib/display.test.cjs`
- `src/commands/display.cjs`

### Concern 5: dependent-unchanged (7 files)
Dependent files with no branding-specific changes; included as structural dependencies.
- `src/commands/commands.test.cjs`
- `src/commands/misc.cjs`
- `src/commands/ui-contract.test.cjs`
- `src/lib/compaction.test.cjs`
- `src/lib/merge.cjs`
- `src/lib/review.cjs`

## Acceptance Criteria
1. [wave-1] `src/modules/roles/role-branding.md` exists and follows existing role module conventions
2. [wave-1] `skills/branding/SKILL.md` exists with valid YAML frontmatter and step-by-step interview flow
3. [wave-1] Both files reference `.planning/branding/BRANDING.md` as the output artifact path
4. [wave-1] SKILL.md uses AskUserQuestion with prefilled options for all 4 branding dimensions
5. [wave-1] SKILL.md includes re-run UX (detect existing BRANDING.md, offer update/fresh/view options)
6. [wave-1] SKILL.md includes static HTML generation and auto-open steps
7. [wave-1] Neither file modifies any existing RAPID source code
8. [wave-2] `display.cjs` has `'branding'` entries in both `STAGE_VERBS` and `STAGE_BG`
9. [wave-2] `display.test.cjs` tests pass with all 16 stages (including scaffold and branding)
10. [wave-2] `execute.cjs` exports `buildBrandingContext(cwd)` function
11. [wave-2] `buildBrandingContext()` reads from `.planning/branding/BRANDING.md` and returns empty string when absent
12. [wave-2] `enrichedPrepareSetContext()` returns `brandingContext` field
13. [wave-2] `assembleExecutorPrompt()` injects branding in ALL 3 phases (discuss, plan, execute)
14. [wave-2] All existing tests continue to pass (no regressions)
15. [wave-2] New branding tests cover: present/absent BRANDING.md, correct path, ordering relative to quality context, scope instructions
16. [wave-2] `node --test src/lib/display.test.cjs` passes
17. [wave-2] `node --test src/lib/execute.test.cjs` passes
