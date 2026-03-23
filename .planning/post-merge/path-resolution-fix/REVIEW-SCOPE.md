# REVIEW-SCOPE: path-resolution-fix

<!-- SCOPE-META {"setId":"path-resolution-fix","date":"2026-03-23T15:30:00.000Z","postMerge":true,"worktreePath":"/home/kek/Projects/RAPID","totalFiles":9,"useConcernScoping":true} -->

## Set Metadata
| Field | Value |
|-------|-------|
| Set ID | path-resolution-fix |
| Date | 2026-03-23T15:30:00.000Z |
| Post-Merge | true |
| Worktree Path | /home/kek/Projects/RAPID |
| Total Files | 9 |
| Concern Scoping | true |

## Changed Files
| File | Wave Attribution |
|------|-----------------|
| `.planning/STATE.json` | unattributed |
| `.planning/sets/path-resolution-fix/CONTEXT.md` | unattributed |
| `.planning/sets/path-resolution-fix/DEFERRED.md` | unattributed |
| `.planning/sets/path-resolution-fix/VERIFICATION-REPORT.md` | unattributed |
| `.planning/sets/path-resolution-fix/WAVE-1-COMPLETE.md` | unattributed |
| `.planning/sets/path-resolution-fix/wave-1-PLAN-DIGEST.md` | unattributed |
| `.planning/sets/path-resolution-fix/wave-1-PLAN.md` | unattributed |
| `skills/init/SKILL.md` | unattributed |
| `skills/register-web/SKILL.md` | unattributed |

## Dependent Files
| File |
|------|
| (none) |

## Directory Chunks
### Chunk 1: .
- `.planning/STATE.json`
- `.planning/sets/path-resolution-fix/CONTEXT.md`
- `.planning/sets/path-resolution-fix/DEFERRED.md`
- `.planning/sets/path-resolution-fix/VERIFICATION-REPORT.md`
- `.planning/sets/path-resolution-fix/WAVE-1-COMPLETE.md`
- `.planning/sets/path-resolution-fix/wave-1-PLAN-DIGEST.md`
- `.planning/sets/path-resolution-fix/wave-1-PLAN.md`
- `skills/init/SKILL.md`
- `skills/register-web/SKILL.md`

## Wave Attribution
| File | Wave |
|------|------|
| `.planning/STATE.json` | unattributed |
| `.planning/sets/path-resolution-fix/CONTEXT.md` | unattributed |
| `.planning/sets/path-resolution-fix/DEFERRED.md` | unattributed |
| `.planning/sets/path-resolution-fix/VERIFICATION-REPORT.md` | unattributed |
| `.planning/sets/path-resolution-fix/WAVE-1-COMPLETE.md` | unattributed |
| `.planning/sets/path-resolution-fix/wave-1-PLAN-DIGEST.md` | unattributed |
| `.planning/sets/path-resolution-fix/wave-1-PLAN.md` | unattributed |
| `skills/init/SKILL.md` | unattributed |
| `skills/register-web/SKILL.md` | unattributed |

## Concern Scoping

### Concern: skill-path-fixes
| File | Rationale |
|------|-----------|
| `skills/init/SKILL.md` | Primary modified file -- 2 broken require() paths replaced with path.dirname resolution |
| `skills/register-web/SKILL.md` | Primary modified file -- 2 broken require() paths replaced with path.dirname resolution |

### Concern: set-planning-artifacts
| File | Rationale |
|------|-----------|
| `.planning/sets/path-resolution-fix/CONTEXT.md` | Set boundary definition and implementation decisions for the path fix |
| `.planning/sets/path-resolution-fix/DEFERRED.md` | Deferred decisions log (empty -- no deferred items) |
| `.planning/sets/path-resolution-fix/VERIFICATION-REPORT.md` | Wave-1 verification report confirming plan correctness |
| `.planning/sets/path-resolution-fix/WAVE-1-COMPLETE.md` | Wave-1 completion marker with commit reference |
| `.planning/sets/path-resolution-fix/wave-1-PLAN-DIGEST.md` | Condensed summary of wave-1 plan and outcome |
| `.planning/sets/path-resolution-fix/wave-1-PLAN.md` | Detailed wave-1 task plan with 4 require() fix tasks |

### Cross-Cutting Files
| File | Rationale |
|------|-----------|
| `.planning/STATE.json` | Global project state tracking all milestones and sets -- not specific to path-resolution-fix concern |

## Acceptance Criteria
1. [wave-1] All 4 `require()` calls use `path.dirname('${RAPID_TOOLS}')` instead of `'${RAPID_TOOLS}/../'`
2. [wave-1] Zero occurrences of the old `${RAPID_TOOLS}/../lib/` pattern remain in owned files
3. [wave-1] The `node -e` syntax check resolves `/fake/src/bin/rapid-tools.cjs` to `/fake/src/lib/context.cjs`
4. [wave-1] No other lines in either file are modified beyond the 4 targeted require statements
