# Stack Research: new-version-ux

## Core Stack Assessment

### SKILL.md (Prompt Document)
- **Type:** LLM orchestrator prompt, not executable code
- **Runtime:** Claude Code CLI interpreting markdown instructions
- **Key implication:** All "implementation" is prompt engineering -- modifying instruction text that guides Claude's behavior. There are no functions to call, no imports to manage, no build steps.
- **Constraint:** Changes must be expressed as natural language instructions with embedded bash snippets, not as programmatic logic.

### Relevant Technologies
| Technology | Role | Version Concern |
|-----------|------|-----------------|
| Claude Code CLI | Runtime interpreter for SKILL.md | N/A -- managed externally |
| Node.js | Runs rapid-tools.cjs CLI | No version change needed |
| rapid-tools.cjs | State management CLI | Must support `state get --all` for milestone array access |
| Bash (find/glob) | File discovery in SKILL.md snippets | Current `find` pattern needs expansion |

## Dependency Health

This set has **no package dependencies** to assess. The entire change is within a single SKILL.md prompt file. The only "dependencies" are:

| Component | Status | Notes |
|-----------|--------|-------|
| `rapid-tools.cjs state get --all` | Active, healthy | Returns full STATE.json including milestones array -- needed to derive previous milestone ID |
| `AskUserQuestion` tool | Active, healthy | Claude Code built-in tool used for all interactive prompts |
| `find` command | Active | Used in current DEFERRED.md discovery at line 128 |
| `Agent` tool | Active, healthy | Used for spawning researcher subagents in Step 5 |

## Compatibility Matrix

### STATE.json Milestones Array
- **Required structure:** `milestones` is an ordered array of `{ id, name, sets }` objects
- **`currentMilestone`** field gives the active milestone ID
- **Previous milestone derivation:** Find the index of `currentMilestone` in the `milestones` array, then access `milestones[index - 1].id`
- **Confirmed:** Current STATE.json has 16 milestones, current is `v4.3.0`, previous is `v4.2.1`
- **Edge case:** If `currentMilestone` is the first milestone (index 0), there is no previous milestone -- archive scanning should be skipped

### DEFERRED.md Format Compatibility
- **Standard format:** Markdown table with columns `#`, `Decision/Idea`, `Source`, `Suggested Target`
- **Empty table pattern:** Header row present but no data rows (most common case -- 5 of 7 files examined are empty)
- **Non-empty example:** `audit-version/DEFERRED.md` has 2 entries with pipe-delimited table rows
- **File locations confirmed:**
  - Active sets: `.planning/sets/*/DEFERRED.md` (4 files found, all empty for v4.3.0)
  - Archived sets: `.planning/archive/{milestoneId}/sets/*/DEFERRED.md` (3 files found for v4.2.1, 1 non-empty)

### Spec File Path Resolution
- **No existing argument parsing** in Step 0 -- the env preamble loads `RAPID_TOOLS` only
- **Spec file must be read via `Read` tool** (not bash `cat`), since SKILL.md is interpreted by Claude Code
- **Path types to handle:** Absolute paths, relative paths (relative to project root), tilde-prefixed paths

## Upgrade Paths

No upgrades needed. This set modifies only a prompt document.

## Tooling Assessment

### Current DEFERRED.md Discovery (Line 128)
```bash
DEFERRED_FILES=$(find .planning/sets/*/DEFERRED.md 2>/dev/null)
```
**Gap:** Only searches active sets. Does NOT search archive directory.

**Required expansion for auto-discovery:**
```bash
# Active sets
ACTIVE_DEFERRED=$(find .planning/sets/*/DEFERRED.md 2>/dev/null)
# Previous milestone archive (derive {prevMilestoneId} from STATE.json)
ARCHIVE_DEFERRED=$(find .planning/archive/{prevMilestoneId}/sets/*/DEFERRED.md 2>/dev/null)
```

### Spec File Parsing
- **No external tool needed** -- the LLM reads the spec file and semantically maps headings to goal categories inline
- **Read tool** is already in the SKILL.md allowed-tools list (line 3)
- **No schema validation tool** exists or is needed -- LLM handles fuzzy heading matching

## Stack Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | DEFERRED.md table parsing fragility -- empty tables vs. populated tables have different markdown structures | Low | Instruct the LLM to check for non-empty data rows after the header, treating header-only tables as empty |
| 2 | Previous milestone ID derivation depends on milestones array ordering | Low | The array is append-only (new milestones added at end), confirmed by 16-entry history |
| 3 | Spec file argument could be confused with other SKILL.md arguments if more are added later | Low | Use a clear `--spec <path>` flag pattern rather than a positional argument |
| 4 | Large spec files could exceed context limits when prepopulating all 5 categories | Low | Spec files are user-written goal summaries -- unlikely to be large. No truncation needed for v1. |

## Recommendations

1. **Use `--spec <path>` flag syntax** for the spec file argument: Aligns with CLI conventions, avoids ambiguity with future positional args -- Priority: high
2. **Derive previous milestone from milestones array** using the pattern `milestones[indexOf(currentMilestone) - 1].id`: Reliable, confirmed against real STATE.json data -- Priority: high
3. **Combine active + archive DEFERRED.md discovery** into a single bash snippet that always runs both `find` commands: Simpler than conditional logic -- Priority: high
4. **Preserve the existing multiSelect pattern** for deferred item selection (Step 2C-v): Already tested and working, just expand the discovery scope -- Priority: medium
5. **Add a `## Deferred Context` section** to each researcher's brief template in Step 5: Ensures all 6 researchers see deferred items without modifying researcher agent code -- Priority: high
6. **Handle edge case of first-ever milestone** (no previous): Skip archive scanning when `currentMilestone` is at index 0 -- Priority: low (unlikely in practice)

## Implementation-Specific Findings

### Exact Insertion Points in SKILL.md

1. **Step 0 (lines 12-29):** Add `--spec <path>` argument parsing after the env preamble. If `--spec` is provided, read the file contents and store as `specContent`.

2. **Step 2C (lines 74-207):** Conditional branch:
   - **If specContent exists:** LLM semantically parses the spec content, mapping headings to the 5 goal categories. Then present a single consolidated summary (reusing the Step 2C-vi display format) with accept/augment/replace per category.
   - **If no specContent:** Existing 5-prompt sequential flow unchanged.

3. **Step 2C-v (lines 122-146):** Expand the `find` command to include archive path. Derive previous milestone ID from STATE.json. The deferred items are auto-included in `goals.deferredDecisions` and shown in the completeness summary. User can still remove items via the revision loop.

4. **Step 5 (lines 317-457):** Add a `## Deferred Context` section to each researcher agent's brief template, containing all discovered deferred items. This goes after `## Carry-Forward Context` in each of the 6 agent spawn blocks.

### DEFERRED.md Parsing Logic

The LLM should parse DEFERRED.md tables by:
1. Looking for markdown table rows after the header separator (`|---|`)
2. Extracting `Decision/Idea` (column 2) and `Source` (column 3) and `Suggested Target` (column 4)
3. Ignoring rows that are empty or contain only whitespace between pipes
4. Prefixing each item with its source set ID (derived from the file path)

### Backward Compatibility Verification Points

1. When no `--spec` argument: Step 0 proceeds identically (env setup only)
2. When no spec content: Steps 2C-i through 2C-iv are unchanged (sequential category prompts)
3. Step 2C-v deferred discovery: Now auto-includes items instead of prompting for selection, but still shown in completeness summary
4. Step 2C-vi completeness gate: Unchanged
5. Steps 3-9: Completely untouched
