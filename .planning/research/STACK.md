# Stack Research: audit-version

## Core Stack Assessment

### Node.js Runtime
- **Detected version:** 18+ (package.json engines constraint)
- **Latest stable:** 22.x LTS (as of March 2026)
- **Relevant features:** CommonJS used throughout (.cjs), built-in `node:test` for tests, `fs` and `child_process` for filesystem and git operations
- **No upgrade needed:** The audit-version command uses only standard Node.js APIs (fs, path, child_process) that are stable across 18-22.x

### Zod 3.25.76
- **Role:** State schema validation (STATE.json parsing)
- **Relevance to audit:** The auditor must READ state via `node "${RAPID_TOOLS}" state get --all`, which returns Zod-validated JSON. The auditor never mutates state, so no schema interaction needed in the new code itself.
- **No direct dependency:** The role-auditor.md and SKILL.md are markdown files -- they consume CLI output, not library APIs directly.

### Ajv 8.17.1
- **Role:** JSON Schema validation for CONTRACT.json files
- **Relevance to audit:** The auditor reads CONTRACT.json files to extract acceptance criteria. These are plain JSON reads -- no Ajv validation needed in the audit flow (Ajv validates at planning/execution/merge gates, not at audit time).

## Dependency Health

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| zod | 3.25.76 | 3.25.x | Current | No action needed |
| ajv | 8.17.1 | 8.17.x | Current | No action needed |
| ajv-formats | 3.0.1 | 3.0.x | Current | No action needed |
| proper-lockfile | 4.1.2 | 4.1.x | Current | No action needed |

**Assessment:** All 4 production dependencies are current. No CVEs or upgrade concerns.

## Compatibility Matrix

No compatibility issues identified for this set. The audit-version command:
- Creates only markdown files (.planning/v{version}-AUDIT.md, .planning/v{version}-DEFERRED.md)
- Reads existing JSON files (STATE.json, CONTRACT.json) via the CLI
- Does not introduce new dependencies
- Does not require new Node.js APIs beyond what the project already uses

## Implementation-Specific Stack Analysis

### Files to Create

1. **`skills/audit-version/SKILL.md`** -- Markdown skill definition
   - Pattern: Follows existing skill structure (YAML frontmatter + step-by-step instructions)
   - Frontmatter needs: `description`, `allowed-tools`
   - Required tools: `Bash(rapid-tools:*)`, `Agent`, `AskUserQuestion`, `Read`, `Write`, `Glob`, `Grep`
   - The SKILL.md orchestrates: version resolution, state reading, artifact loading, agent spawning, user prompts for remediation

2. **`src/modules/roles/role-auditor.md`** -- Agent role module
   - Pattern: Plain markdown, no code execution
   - Gets assembled into `agents/rapid-auditor.md` by `build-agents` command
   - Requires registration in `src/commands/build-agents.cjs` (4 maps: ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS, ROLE_CORE_MAP)

3. **`src/lib/display.cjs`** -- Existing file, needs 2 additions:
   - `STAGE_VERBS['audit-version'] = 'AUDITING'`
   - `STAGE_BG['audit-version'] = '\x1b[101m'` (bright red -- review/analysis stage)

### Build System Registration (build-agents.cjs)

The auditor agent needs entries in 4 maps within `src/commands/build-agents.cjs`:

| Map | Key | Value | Rationale |
|-----|-----|-------|-----------|
| `ROLE_TOOLS` | `'auditor'` | `'Read, Grep, Glob, Write'` | Reads artifacts, writes report -- no Bash needed (read-only) |
| `ROLE_COLORS` | `'auditor'` | `'red'` | Review/analysis category |
| `ROLE_DESCRIPTIONS` | `'auditor'` | `'RAPID auditor agent -- analyzes milestone delivery against planned requirements'` | Follows existing description format |
| `ROLE_CORE_MAP` | `'auditor'` | `['core-identity.md', 'core-returns.md']` | No conventions (doesn't commit code) |

After adding these, running `node src/bin/rapid-tools.cjs build-agents` will generate `agents/rapid-auditor.md`.

### CLI Integration

No new CLI command needed in `rapid-tools.cjs`. The audit workflow is entirely skill-driven:
- SKILL.md uses existing CLI commands: `state get --all`, `display banner`, `resolve set`, `state add-set`
- The role-auditor agent is spawned via the `Agent` tool from SKILL.md

### Artifact Reading Patterns

The auditor needs to read these artifacts per milestone:

| Artifact | Path | Read Method | Notes |
|----------|------|-------------|-------|
| STATE.json | `.planning/STATE.json` | `node "${RAPID_TOOLS}" state get --all` | CLI returns Zod-validated JSON |
| ROADMAP.md | `.planning/ROADMAP.md` | Read tool | Parse milestone sections |
| REQUIREMENTS.md | `.planning/REQUIREMENTS.md` | Read tool | May not exist -- fallback to ROADMAP.md |
| CONTRACT.json | `.planning/sets/{setId}/CONTRACT.json` | Read tool | Per-set acceptance criteria in `definition.acceptance` |
| VERIFICATION-REPORT.md | `.planning/sets/{setId}/VERIFICATION-REPORT.md` | Read tool | Delivery evidence per wave |
| WAVE-*-COMPLETE.md | `.planning/sets/{setId}/WAVE-*-COMPLETE.md` | Glob + Read | Completion markers |

### Milestone Completion Detection

STATE.json has no milestone-level status field. Completion must be derived:

```javascript
// Pseudocode for the skill's logic
const milestone = state.milestones.find(m => m.id === targetVersion);
const allMerged = milestone.sets.every(s => s.status === 'merged');
```

For version resolution (defaulting to most recently completed milestone), iterate milestones in reverse order and find the first where all sets are merged.

### Two-Pass Architecture for Large Milestones

For milestones with 5+ sets, the agent should use a two-pass approach to avoid context limits:

- **Pass 1:** Structured field parsing -- read CONTRACT.json `definition.acceptance` arrays and STATE.json set statuses. Build a coverage matrix.
- **Pass 2:** Semantic matching -- for items flagged as ambiguous in Pass 1, read VERIFICATION-REPORT.md and WAVE-*-COMPLETE.md to verify delivery.

This keeps within the Agent tool's context budget by loading verification artifacts only for disputed items.

## Tooling Assessment

### Build Tools
- Agent build: `node src/bin/rapid-tools.cjs build-agents` -- must be run after adding role-auditor.md
- No changes to build pipeline needed beyond adding the 4 map entries

### Test Framework
- Node.js built-in `node:test` with co-located `.test.cjs` files
- The audit-version set has no library code to unit test (SKILL.md and role-auditor.md are markdown)
- Testing would be integration-level: run the skill against a test project and verify output

### Linting/Formatting
- No linter configured in the project
- Code style follows existing conventions (strict mode, JSDoc comments, CommonJS)

## Stack Risks

1. **Context budget overflow on large milestones:** Milestones with 8+ sets (e.g., v4.1.0 had 8 sets) could exceed agent context when loading all CONTRACT.json + VERIFICATION-REPORT.md files simultaneously.
   - **Impact:** Agent truncation or missed gaps
   - **Mitigation:** Two-pass architecture (Pass 1 structured, Pass 2 selective semantic)

2. **REQUIREMENTS.md format instability:** The requirements file uses markdown checkboxes with ad-hoc IDs (STATE-01, AGENT-01, etc.). Parsing relies on pattern matching.
   - **Impact:** Missed requirements in gap analysis
   - **Mitigation:** Fall back to ROADMAP.md + CONTRACT.json when REQUIREMENTS.md parsing is unreliable; note reduced confidence in report

3. **Older milestones have empty sets arrays in STATE.json:** Milestones v1.0 through v3.0 have `"sets": []` in the current STATE.json.
   - **Impact:** Cannot audit these milestones -- no set data to cross-reference
   - **Mitigation:** Detect empty sets array and report "Insufficient state data for milestone {version}. Set-level tracking was not available for this milestone."

4. **CONTRACT.json path discrepancy:** The CONTEXT.md notes that CONTRACT.json references `src/agents/roles/` but actual roles live at `src/modules/roles/`. This affects only the audit-version set's own CONTRACT.json `ownedFiles` array, not the audit logic itself.
   - **Impact:** Low -- only affects self-referential accuracy
   - **Mitigation:** Use correct path `src/modules/roles/role-auditor.md` during implementation

## Recommendations

1. **Add display.cjs banner entry first:** Trivial change, unblocks all other work. Priority: critical.
2. **Register auditor in build-agents.cjs maps:** 4 map entries required before the agent can be built. Priority: critical.
3. **Use `state get --all` for all state reads:** Never read STATE.json directly -- the CLI provides Zod-validated output. Priority: high.
4. **Implement REQUIREMENTS.md parser with graceful degradation:** Parse `- [x]` and `- [ ]` lines with ID prefixes; if parsing yields < 3 items, fall back to ROADMAP.md scope descriptions. Priority: high.
5. **Cap per-set artifact loading at ~20KB:** For the semantic pass, read only the first 100 lines of each VERIFICATION-REPORT.md to stay within context budget. Priority: medium.
6. **Fix CONTRACT.json ownedFiles path:** Update from `src/agents/roles/role-auditor.md` to `src/modules/roles/role-auditor.md`. Priority: low.
