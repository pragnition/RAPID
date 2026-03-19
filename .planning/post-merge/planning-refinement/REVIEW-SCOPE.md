# REVIEW-SCOPE: planning-refinement

<!-- SCOPE-META {"setId":"planning-refinement","date":"2026-03-19T04:44:30.898Z","postMerge":true,"worktreePath":"/home/kek/Projects/RAPID","totalFiles":10,"useConcernScoping":true} -->

## Set Metadata

| Field | Value |
|-------|-------|
| Set ID | planning-refinement |
| Date | 2026-03-19T04:44:30.898Z |
| Post-Merge | true |
| Worktree Path | /home/kek/Projects/RAPID |
| Total Files | 10 |
| Concern Scoping | true |

## Changed Files

| File | Wave Attribution |
|------|-----------------|
| `.planning/STATE.json` | unattributed |
| `.planning/sets/planning-refinement/CONTEXT.md` | unattributed |
| `.planning/sets/planning-refinement/VERIFICATION-REPORT.md` | unattributed |
| `.planning/sets/planning-refinement/WAVE-1-COMPLETE.md` | unattributed |
| `.planning/sets/planning-refinement/wave-1-PLAN-DIGEST.md` | unattributed |
| `.planning/sets/planning-refinement/wave-1-PLAN.md` | unattributed |
| `skills/bug-hunt/SKILL.md` | unattributed |
| `skills/discuss-set/SKILL.md` | unattributed |
| `skills/uat/SKILL.md` | unattributed |
| `skills/unit-test/SKILL.md` | unattributed |

## Dependent Files

No dependent files detected.

## Directory Chunks

### Chunk 1: .planning/sets/planning-refinement

- `.planning/sets/planning-refinement/CONTEXT.md`
- `.planning/sets/planning-refinement/VERIFICATION-REPORT.md`
- `.planning/sets/planning-refinement/WAVE-1-COMPLETE.md`
- `.planning/sets/planning-refinement/wave-1-PLAN-DIGEST.md`
- `.planning/sets/planning-refinement/wave-1-PLAN.md`

### Chunk 2: skills

- `skills/bug-hunt/SKILL.md`
- `skills/discuss-set/SKILL.md`
- `skills/uat/SKILL.md`
- `skills/unit-test/SKILL.md`

### Chunk 3: .planning

- `.planning/STATE.json`

## Wave Attribution

No wave attribution available.

## Concern Scoping

### review-skill-auto-detect

- `skills/bug-hunt/SKILL.md`
- `skills/uat/SKILL.md`
- `skills/unit-test/SKILL.md`

### discuss-set-ux-guidance

- `skills/discuss-set/SKILL.md`

### set-planning-artifacts

- `.planning/sets/planning-refinement/CONTEXT.md`
- `.planning/sets/planning-refinement/VERIFICATION-REPORT.md`
- `.planning/sets/planning-refinement/WAVE-1-COMPLETE.md`
- `.planning/sets/planning-refinement/wave-1-PLAN-DIGEST.md`
- `.planning/sets/planning-refinement/wave-1-PLAN.md`

### Cross-Cutting Files

- `.planning/STATE.json`: Project-wide state tracking for all sets


## Acceptance Criteria

1. [wave-1] `node --test skills/discuss-set/SKILL.test.cjs` -- all 9 tests pass
2. [wave-1] discuss-set SKILL.md Step 5 contains UI/UX conditional guidance paragraph between the criteria list and the AskUserQuestion block
3. [wave-1] discuss-set SKILL.md Step 5 still has exactly 4 numbered gray area options (no 5th option added)
4. [wave-1] unit-test, bug-hunt, and uat SKILL.md files all have auto-detection fallback in Step 1
5. [wave-1] All three review skills retain `--post-merge` flag detection in Step 0b
6. [wave-1] All three review skills guard check error messages reference both checked paths
7. [wave-1] Each review skill auto-detect bullet references the correct downstream artifact (REVIEW-UNIT.md, REVIEW-BUGS.md, REVIEW-UAT.md respectively)
