---
phase: 13-merge-and-cleanup-skill-prompts
verified: 2026-03-06T03:00:00Z
status: passed
score: 16/16 must-haves verified
re_verification: false
---

# Phase 13: Merge and Cleanup Skill Prompts Verification Report

**Phase Goal:** Merge and cleanup skills use structured prompts for confirmations, recovery from errors, and explanation of reviewer verdicts
**Verified:** 2026-03-06T03:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Before merge pipeline starts, developer sees structured Start merge / Cancel prompt with inline summary | VERIFIED | merge SKILL.md lines 48-54: AskUserQuestion with "Start merge" (includes set/wave counts) and "Cancel" |
| 2 | Between waves, developer sees structured Continue to Wave N+1 / Pause pipeline prompt | VERIFIED | merge SKILL.md lines 390-396: AskUserQuestion with "Continue to Wave {waveNum+1}" and "Pause pipeline" |
| 3 | After pipeline completes, developer sees structured Run cleanup / View status / Done next-action prompt | VERIFIED | merge SKILL.md lines 416-421: AskUserQuestion with three next-action options |
| 4 | When merge conflict occurs, developer sees structured Resolve manually / Show diff / Abort pipeline options | VERIFIED | merge SKILL.md lines 289-294: AskUserQuestion with three conflict recovery options plus follow-up prompts |
| 5 | When integration gate fails, developer sees structured Investigate / Revert wave / Abort pipeline options | VERIFIED | merge SKILL.md lines 364-369: AskUserQuestion with three gate failure options |
| 6 | Revert wave triggers double confirmation before executing destructive action | VERIFIED | merge SKILL.md lines 376-383: second AskUserQuestion listing affected sets before confirming revert |
| 7 | After reviewer verdict, developer sees clear verdict banner with emoji, label, and findings summary | VERIFIED | merge SKILL.md lines 141/146/151: checkmark/wrench/no-entry emoji + APPROVED/CHANGES/BLOCKED labels + summary |
| 8 | BLOCK verdict shows structured View full review / Skip set / Abort pipeline options | VERIFIED | merge SKILL.md lines 153-158: AskUserQuestion with three BLOCK options, plus second prompt after viewing review |
| 9 | Cleanup escalation shows structured Fix manually / Skip set / Abort pipeline options | VERIFIED | merge SKILL.md lines 253-258: AskUserQuestion after 2 cleanup rounds with three escalation options |
| 10 | No STOP or halt keywords exist anywhere in merge SKILL.md | VERIFIED | `grep -ciE '\bSTOP\b\|\bhalt\b'` returns 0 |
| 11 | Developer selects worktree from structured AskUserQuestion options (up to 4 worktrees) | VERIFIED | cleanup SKILL.md lines 28-34: AskUserQuestion with one option per worktree |
| 12 | If more than 4 worktrees, falls back to text list with freeform input | VERIFIED | cleanup SKILL.md lines 36-38: numbered text list with freeform input for >4 |
| 13 | Before removal, developer sees structured confirmation listing what gets deleted | VERIFIED | cleanup SKILL.md lines 45-49: "Remove worktree" option describes deletion of directory, branch preserved |
| 14 | When dirty worktree blocks removal, developer sees Commit / Stash / Force remove / Cancel options | VERIFIED | cleanup SKILL.md lines 77-83: four structured options with specific git commands in descriptions |
| 15 | Force remove triggers double confirmation before executing destructive action | VERIFIED | cleanup SKILL.md lines 102-108: nested AskUserQuestion with explicit "Cannot be undone" warning |
| 16 | No STOP or halt keywords exist anywhere in cleanup SKILL.md | VERIFIED | `grep -ciE '\bSTOP\b\|\bhalt\b'` returns 0 |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `skills/merge/SKILL.md` | Merge pipeline with AskUserQuestion at all decision gates and verdict explanations | VERIFIED | 432 lines, 14 AskUserQuestion references, 0 STOP/halt keywords, AskUserQuestion in allowed-tools frontmatter |
| `skills/cleanup/SKILL.md` | Cleanup skill with AskUserQuestion at all decision gates and dirty worktree recovery | VERIFIED | 133 lines, 6 AskUserQuestion references, 0 STOP/halt keywords, AskUserQuestion in allowed-tools frontmatter |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `skills/merge/SKILL.md` | AskUserQuestion tool | allowed-tools frontmatter | WIRED | Line 3: `allowed-tools: Read, Write, Bash, Agent, AskUserQuestion` |
| `skills/cleanup/SKILL.md` | AskUserQuestion tool | allowed-tools frontmatter | WIRED | Line 3: `allowed-tools: Bash, Read, AskUserQuestion` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROMPT-09 | 13-01 | Merge skill uses AskUserQuestion for final merge confirmation before irreversible action | SATISFIED | Step 1 AskUserQuestion with "Start merge" / "Cancel" (lines 48-54) |
| PROMPT-10 | 13-01 | Merge skill uses AskUserQuestion for merge conflict recovery (resolve/show/revert) | SATISFIED | Step 6 AskUserQuestion with "Resolve manually" / "Show diff" / "Abort pipeline" (lines 289-294) |
| PROMPT-11 | 13-02 | Cleanup skill uses AskUserQuestion for destructive worktree removal confirmation | SATISFIED | Step 3 AskUserQuestion with "Remove worktree" / "Cancel" listing deletion consequences (lines 45-49) |
| ERRR-01 | 13-01 | Merge skill offers structured recovery options on merge conflict instead of halting pipeline | SATISFIED | Merge conflict (lines 289-326) and integration gate failure (lines 364-386) both offer structured recovery with follow-up prompts |
| ERRR-02 | 13-02 | Cleanup skill provides specific resolution steps (commit/stash commands) when dirty worktree blocks removal | SATISFIED | Dirty worktree recovery with 4 options including specific git commands in descriptions (lines 77-118) |
| ERRR-04 | 13-01 | Merge skill explains verdict meanings (APPROVE/CHANGES/BLOCK) and shows allowed cleanup rounds | SATISFIED | Verdict banners with emoji + label + findings summary (lines 141/146/151), cleanup round tracking "round N/2" (lines 146, 184, 232) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| -- | -- | No anti-patterns found | -- | -- |

No TODO/FIXME/placeholder comments, no empty implementations, no stub patterns detected in either skill file.

### Human Verification Required

### 1. Merge Confirmation Flow

**Test:** Run `/rapid:merge` with a project that has completed sets ready to merge
**Expected:** AskUserQuestion prompt appears with "Start merge" showing set/wave counts and "Cancel" option
**Why human:** Requires live Claude Code session with AskUserQuestion tool to verify prompt rendering

### 2. Merge Conflict Recovery

**Test:** Trigger a merge conflict during pipeline execution
**Expected:** Three-option structured prompt (Resolve/Show diff/Abort) appears instead of pipeline halting
**Why human:** Requires actual merge conflict to trigger the error path

### 3. Dirty Worktree Recovery

**Test:** Run `/rapid:cleanup` on a worktree with uncommitted changes
**Expected:** Four-option structured prompt (Commit/Stash/Force/Cancel) with specific git commands in descriptions
**Why human:** Requires dirty worktree state to trigger the recovery path

### 4. Force Removal Double Confirmation

**Test:** Select "Force remove" from dirty worktree prompt
**Expected:** Second AskUserQuestion appears with "Cannot be undone" warning before proceeding
**Why human:** Requires sequential prompt interaction to verify double confirmation gate

### Gaps Summary

No gaps found. All 16 observable truths verified against the actual codebase. Both skill files contain substantive AskUserQuestion structured prompts at every decision gate, verdict banners with emoji/label/summary, structured error recovery paths, and double confirmation gates for destructive actions. All 6 requirements (PROMPT-09, PROMPT-10, PROMPT-11, ERRR-01, ERRR-02, ERRR-04) are satisfied with clear implementation evidence. Commits 19a6990 and 146acaa verified in git history.

---

_Verified: 2026-03-06T03:00:00Z_
_Verifier: Claude (gsd-verifier)_
