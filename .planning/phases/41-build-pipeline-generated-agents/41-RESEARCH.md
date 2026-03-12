# Phase 41: Build Pipeline & Generated Agents - Research

**Researched:** 2026-03-12
**Domain:** Build pipeline hybrid generation, agent pruning, init research pipeline
**Confidence:** HIGH

## Summary

Phase 41 transforms the build-agents pipeline from "generate everything" to a hybrid model: 5 core agents are skipped via a SKIP_GENERATION array and receive hand-written stubs instead, while all other roles continue to be fully generated. Simultaneously, 5 obsolete v2 wave/job roles (wave-researcher, wave-planner, job-planner, job-executor, wave-analyzer) are removed from all registries, role modules, generated agents, and tests. A 6th researcher (research-ux) is added to the init pipeline.

The codebase is well-structured for these changes. All role registrations live in 4 parallel maps within `handleBuildAgents()` in `rapid-tools.cjs` (ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS, ROLE_CORE_MAP), plus ROLE_TOOL_MAP in `tool-docs.cjs`. The build loop at line 694 iterates `ROLE_CORE_MAP` entries, making it the natural insertion point for SKIP_GENERATION. The init skill at `skills/init/SKILL.md` has a clear parallel-spawn section (Step 7) where the 6th researcher slots in.

**Primary recommendation:** Implement as 4 discrete tasks: (1) add SKIP_GENERATION + modify build loop, (2) prune 5 v2 roles from all registries/files, (3) add research-ux role + registrations, (4) update init skill + synthesizer for 6 researchers. Update all 3 test files to match.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- SKIP_GENERATION is a static hardcoded array: `SKIP_GENERATION = ['orchestrator', 'planner', 'executor', 'merger', 'reviewer']`
- Core agents stay in ROLE_CORE_MAP (used for tool doc generation, frontmatter lookups) -- build loop skips them
- Silent skip -- no log output for skipped agents
- Build summary shows both counts: "Built 22 agents (5 core skipped) in agents/"
- 5th researcher agent name: `research-ux` (role module: `role-research-ux.md`, agent: `rapid-research-ux.md`)
- Focus: domain conventions AND UX patterns
- Tools: Read, Grep, Glob, WebFetch, WebSearch (same as other research agents)
- Pipeline position: parallel with other 5 researchers, synthesizer waits for all 6
- Remove 5 v2 wave/job agents NOW: wave-planner, wave-researcher, wave-analyzer, job-planner, job-executor
- Full deletion: role modules, generated agent files, and all registry entries
- Also clean up ROLE_TOOL_MAP in tool-docs.cjs for the 5 removed roles
- KEEP codebase-synthesizer and context-generator
- Core agent stubs: YAML frontmatter + `<tools>` section from tool-docs.cjs + `<role>` as TODO placeholder for Phase 42
- SKIP_GENERATION array is the sole mechanism for identifying core agents -- no file-level markers

### Claude's Discretion
- Exact content of the research-ux role module prompt
- How to update the init skill to spawn the 6th researcher
- Stub content for core agent `<role>` placeholders
- Whether to add a build-time validation that SKIP_GENERATION entries actually exist in ROLE_CORE_MAP

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGENT-03 | Hybrid build pipeline: SKIP_GENERATION set for core agents, ROLE_TOOL_DOCS for per-agent tool injection | SKIP_GENERATION array in build loop, `assembleAgentPrompt()` reused for stub generation with modified `<role>` section, build summary format change |
| AGENT-04 | 5 core agents (orchestrator, planner, executor, merger, reviewer) hand-written and never overwritten by build | SKIP_GENERATION check at line 694 build loop; core agents get stub files with frontmatter + tools + placeholder `<role>` section; Phase 42 fills in real role content |
| AGENT-06 | 5th researcher (Domain/UX) added to init research pipeline | New role module `role-research-ux.md`, registrations in all 4 maps, init SKILL.md Step 7 updated to spawn 6 agents, synthesizer role module updated to read 6 files |
</phase_requirements>

## Architecture Patterns

### Current Build Pipeline Structure
```
src/bin/rapid-tools.cjs
  handleBuildAgents()           # Line 450 -- main entry
    ROLE_TOOLS                  # Line 461 -- tool assignments per role
    ROLE_COLORS                 # Line 498 -- color per role
    ROLE_DESCRIPTIONS           # Line 535 -- description per role
    ROLE_CORE_MAP               # Line 572 -- core module mapping per role
    generateFrontmatter(role)   # Line 608 -- YAML frontmatter
    assembleAgentPrompt(role, coreModules)  # Line 622 -- full prompt assembly
    Build loop                  # Line 694 -- iterates ROLE_CORE_MAP

src/lib/tool-docs.cjs
    TOOL_REGISTRY               # Line 9   -- 59 command entries
    ROLE_TOOL_MAP               # Line 111 -- role -> command keys
    getToolDocsForRole(role)    # Line 157 -- returns YAML tool docs
```

### Recommended Modification Pattern

**SKIP_GENERATION integration (line 694):**
```javascript
const SKIP_GENERATION = ['orchestrator', 'planner', 'executor', 'merger', 'reviewer'];

for (const [role, coreModules] of Object.entries(ROLE_CORE_MAP)) {
  if (SKIP_GENERATION.includes(role)) {
    skipped.push(role);
    continue;
  }
  const assembled = assembleAgentPrompt(role, coreModules);
  const content = GENERATED_COMMENT + assembled;
  const filePath = path.join(agentsDir, `rapid-${role}.md`);
  fs.writeFileSync(filePath, content, 'utf-8');
  built.push(filePath);
}
```

**Core agent stub generation (separate function):**
```javascript
function assembleStubPrompt(role) {
  const sections = [];
  sections.push(generateFrontmatter(role));

  // Tool docs only (no core modules -- core agents are fully hand-written)
  const toolDocs = getToolDocsForRole(role);
  if (toolDocs) {
    sections.push(`<tools>\n${toolDocs}\n</tools>`);
  }

  sections.push(`<role>\n<!-- TODO: Phase 42 -- hand-write ${role} role instructions -->\n</role>`);

  return sections.join('\n\n');
}
```

**Important design note:** Core agent stubs should NOT include core modules (`<identity>`, `<conventions>`, `<returns>`) since the whole point of Phase 42 is to hand-write these agents with complete control over their content. The stubs exist only to make Claude Code agent discovery work (frontmatter + tools) while clearly marking the `<role>` section as Phase 42 work.

However, re-reading the CONTEXT.md decision: "Core agents use XML skeleton: identity, conventions, tools, returns sections follow standard structure. `<role>` section is freeform." This means core agents DO use the standard `<identity>`, `<conventions>`, and `<returns>` sections. Only `<role>` is custom. So stubs should include core modules plus a placeholder `<role>`.

**Revised stub approach (include core modules):**
```javascript
function assembleStubPrompt(role, coreModules) {
  const sections = [];
  sections.push(generateFrontmatter(role));

  // Core modules (same as generated agents)
  let returnsModule = null;
  for (const mod of coreModules) {
    if (mod === 'core-returns.md') { returnsModule = mod; continue; }
    const modPath = path.join(MODULES_DIR, 'core', mod);
    const content = fs.readFileSync(modPath, 'utf-8').trim();
    const tag = mod.replace('.md', '').replace('core-', '');
    sections.push(`<${tag}>\n${content}\n</${tag}>`);
  }

  // Tool docs
  const toolDocs = getToolDocsForRole(role);
  if (toolDocs) {
    sections.push(`<tools>\n${toolDocs}\n</tools>`);
  }

  // Placeholder role section
  sections.push(`<role>\n<!-- TODO: Phase 42 -- hand-write ${role} role instructions -->\n</role>`);

  // Returns (last section per PROMPT-SCHEMA.md)
  if (returnsModule) {
    const modPath = path.join(MODULES_DIR, 'core', returnsModule);
    const content = fs.readFileSync(modPath, 'utf-8').trim();
    sections.push(`<returns>\n${content}\n</returns>`);
  }

  return sections.join('\n\n');
}
```

### Build Summary Format Change
```
// Current:
output(`Built ${built.length} agents in ${agentsDir}`);

// New:
output(`Built ${built.length} agents (${skipped.length} core skipped) in ${agentsDir}`);
```

### File Inventory: What Gets Deleted

**Role modules to delete (src/modules/roles/):**
- `role-wave-researcher.md`
- `role-wave-planner.md`
- `role-job-planner.md`
- `role-job-executor.md`
- `role-wave-analyzer.md`

**Generated agents to delete (agents/):**
- `rapid-wave-researcher.md`
- `rapid-wave-planner.md`
- `rapid-job-planner.md`
- `rapid-job-executor.md`
- `rapid-wave-analyzer.md`

**Registry entries to remove in rapid-tools.cjs:**
- ROLE_TOOLS: 5 entries (wave-researcher, wave-planner, job-planner, job-executor, wave-analyzer)
- ROLE_COLORS: 5 entries (wave-planner, job-planner, wave-researcher, job-executor, wave-analyzer)
- ROLE_DESCRIPTIONS: 5 entries
- ROLE_CORE_MAP: 5 entries

**Registry entries to remove in tool-docs.cjs:**
- ROLE_TOOL_MAP: 4 entries (job-executor, wave-planner, job-planner, wave-analyzer) -- wave-researcher was already in the "no CLI commands" comment
- Comment in ROLE_TOOL_MAP exclusion list: remove `'wave-researcher'` from the comment on line 147

### File Inventory: What Gets Added

**New role module:**
- `src/modules/roles/role-research-ux.md`

**Registry entries to add in rapid-tools.cjs:**
- ROLE_TOOLS: `'research-ux': 'Read, Grep, Glob, WebFetch, WebSearch'`
- ROLE_COLORS: `'research-ux': 'blue'`
- ROLE_DESCRIPTIONS: `'research-ux': 'RAPID research agent -- investigates domain conventions and UX patterns'`
- ROLE_CORE_MAP: `'research-ux': ['core-identity.md', 'core-returns.md']`

**Registry entries in tool-docs.cjs:**
- research-ux has no CLI commands -- add to the exclusion comment on line 147

### Role Counts After Changes
- Current: 31 roles
- Remove: 5 (wave-researcher, wave-planner, job-planner, job-executor, wave-analyzer)
- Add: 1 (research-ux)
- New total: 27 roles
- Of which: 5 core (skipped), 22 generated
- Build summary: "Built 22 agents (5 core skipped) in agents/"

### Init Skill Changes

**Step 7 (skills/init/SKILL.md, line 377-500):**
- Add 6th agent spawn for rapid-research-ux
- Change "ALL 5 research agents" to "ALL 6 research agents"
- Change "Spawn all 5 agents" to "Spawn all 6 agents"
- Change "Wait for ALL 5 agents" to "Wait for ALL 6 agents"

**Step 8 (skills/init/SKILL.md, line 503-528):**
- Add `- .planning/research/UX.md` to the research files list for synthesizer
- The synthesizer spawn context now lists 6 files

**Research-ux spawn task template:**
```
Research domain conventions and UX patterns for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/UX.md
```

### Synthesizer Role Module Changes

`src/modules/roles/role-research-synthesizer.md` needs updates:
- Line 3: "read all 5 research outputs" -> "read all 6 research outputs"
- Line 7: Add `6. **UX.md** -- domain conventions, UX patterns, user expectations, interaction models`
- Line 13: "Read all 5 files" -> "Read all 6 files"
- Line 104: "every finding must cite its source research file (STACK, FEATURES, ARCHITECTURE, PITFALLS, or OVERSIGHTS)" -> add UX
- Line 113-114: "Reads all 5 research outputs" -> "Reads all 6 research outputs"
- Line 123-124: "Does NOT introduce findings not present in the 5 input files" -> "6 input files"
- Line 128: "the function code path conceptually" -- update "5 research files only" -> "6 research files only"
- Line 131: "Read ALL 5 files" -> "Read ALL 6 files"

### Research-UX Role Module Content (Recommended)

```markdown
# Role: Domain & UX Research Agent

You are a domain conventions and UX research subagent. Your job is to investigate how
similar products work in the project's domain, what standard terminology and interaction
patterns users expect, and what UX conventions the project should follow. You produce a
research report that the synthesizer agent will later combine with other research outputs.

## Input

You receive:
1. **Project description** -- what the project does and its goals
2. **Tech stack information** -- detected or planned technology stack
3. **Brownfield analysis** (if available) -- CODEBASE-ANALYSIS.md from the codebase
   synthesizer, containing existing UX patterns and user-facing conventions

Use Context7 MCP for documentation lookups when available. If Context7 is not accessible,
use WebFetch or WebSearch as fallback.

## Output

Write a single file: `.planning/research/UX.md`

### Output Structure

```
# Domain & UX Research

## Domain Conventions
[How similar products in this space work:]
- Standard terminology and naming conventions
- Common workflows and user journeys
- Industry standards and expectations
- Competitive landscape patterns

## Interaction Models
- Primary interaction paradigm (CLI, GUI, API, chat, etc.)
- Input/output patterns users expect
- Feedback and progress indication conventions
- Error communication patterns

## Information Architecture
- How information should be organized and presented
- Navigation and discovery patterns
- Content hierarchy and progressive disclosure
- Help and documentation conventions

## Accessibility Considerations
- Key accessibility patterns for the interaction model
- Screen reader and keyboard navigation (if applicable)
- Color and contrast considerations
- Inclusive design patterns relevant to the domain

## User Expectations
[Based on domain research, what users will assume:]
- Default behaviors they expect
- Terminology they use vs technical terms
- Mental models from competing products
- Onboarding and learning curve expectations

## Recommendations
[Ordered list of UX-related actions for the roadmap:]
1. [Action]: [Rationale] -- [Priority: critical/high/medium/low]
```

### Quality Requirements

- Focus on conventions specific to this project's domain, not generic UX checklists
- For each finding, cite the source (competing product, standard, research)
- Distinguish between "industry standard" and "nice to have"
- Mark sections as "Not applicable" with rationale if they do not apply
- Aim for 100-300 lines of substantive content

## Scope and Constraints

### What This Agent Does
- Researches how similar products work in the project's domain
- Investigates standard terminology and interaction patterns
- Identifies UX conventions the target audience expects
- Recommends UX-related actions for the roadmap

### What This Agent Does NOT Do
- Does NOT research technology stack (that is the Stack agent)
- Does NOT research feature implementations (that is the Features agent)
- Does NOT research architectural patterns (that is the Architecture agent)
- Does NOT research failure modes (that is the Pitfalls agent)
- Does NOT research cross-cutting infrastructure (that is the Oversights agent)
- Does NOT modify any files other than `.planning/research/UX.md`
- Does NOT implement any solutions

### Scope Boundary: UX vs Features vs Oversights
- **UX** = how users EXPECT things to work (conventions, terminology, interaction models)
- **Features** = what to BUILD (implementation strategies, data models, APIs)
- **Oversights** = what gets FORGOTTEN (logging, CI/CD, accessibility infrastructure)
- If a concern is about "user expectations," it belongs here
- If a concern is about "what to implement," it belongs in Features
- If a concern is about "what infrastructure to add," it belongs in Oversights

### Behavioral Constraints
- Prioritize domain-specific conventions over generic UX advice
- If Context7 MCP is unavailable, note it and use web-based fallbacks
- When uncertain about a convention, state the confidence level explicitly
- Complete the research in a single pass; do not request follow-up information
```

### Build-Time Validation (Recommended)

Add a validation that SKIP_GENERATION entries exist in ROLE_CORE_MAP. This prevents stale entries if a core agent is renamed or removed:

```javascript
// Validate SKIP_GENERATION entries exist in ROLE_CORE_MAP
for (const role of SKIP_GENERATION) {
  if (!ROLE_CORE_MAP[role]) {
    error(`SKIP_GENERATION references unknown role "${role}" not in ROLE_CORE_MAP`);
    process.exit(1);
  }
}
```

This is a 3-line guard with zero maintenance cost and prevents silent misconfiguration. Recommended.

### Core Agent Stub File Distinction

Core agent stubs should NOT have the `<!-- GENERATED by build-agents -->` comment prefix since they are not generated in the normal sense. Instead use:

```
<!-- STUB: Core agent -- role section is hand-written in Phase 42 -->
```

This makes it clear at a glance that the file is a placeholder, and ensures no one confuses it with a fully generated agent.

### Anti-Patterns to Avoid

- **Don't check file existence to determine core agents.** The SKIP_GENERATION array is the sole mechanism (per user decision). No `fs.existsSync()` checks.
- **Don't log skipped agents individually.** User decided on silent skip with only the summary count.
- **Don't leave orphan references.** When removing the 5 v2 roles, check ALL 4 maps plus tool-docs.cjs plus tests. Missing one creates a broken build.
- **Don't forget the synthesizer.** Adding a 6th researcher without updating the synthesizer role module means the 6th output is never consumed.

## Common Pitfalls

### Pitfall 1: Orphan Registry Entries
**What goes wrong:** Removing a role from ROLE_CORE_MAP but forgetting ROLE_TOOLS, ROLE_COLORS, or ROLE_DESCRIPTIONS. The build succeeds but leaves dead entries.
**Why it happens:** 4 parallel maps with no cross-validation.
**How to avoid:** Process each of the 5 removals across all 4 maps + tool-docs.cjs ROLE_TOOL_MAP systematically. Use a checklist.
**Warning signs:** Tests passing but `Object.keys(ROLE_TOOLS).length !== Object.keys(ROLE_CORE_MAP).length`.

### Pitfall 2: Test Count Mismatch
**What goes wrong:** Tests assert exactly 31 roles/agents. After removing 5 and adding 1, the count must change to 27.
**Why it happens:** Hardcoded counts and role lists in test files.
**How to avoid:** Update ALL_31_ROLES array in build-agents.test.cjs, EXPECTED_ROLE_CORE_MAP, the "generates exactly 31 .md files" assertion, and tool-docs.test.cjs expected/excluded role lists.
**Warning signs:** `node --test src/lib/build-agents.test.cjs` failing immediately.

### Pitfall 3: Stale Generated Agent Files
**What goes wrong:** Old `rapid-wave-planner.md` etc. still exist in `agents/` directory after removing from ROLE_CORE_MAP.
**Why it happens:** Build loop only writes agents in ROLE_CORE_MAP -- it does not delete files not in the map.
**How to avoid:** Explicitly delete the 5 old agent files from `agents/` as part of the pruning task. The build pipeline does not clean up.
**Warning signs:** `ls agents/ | wc -l` showing more files than expected.

### Pitfall 4: Skills Still Referencing Removed Agents
**What goes wrong:** `skills/plan-set/SKILL.md` and `skills/execute-set/SKILL.md` reference rapid-wave-researcher, rapid-wave-planner, rapid-job-planner, rapid-job-executor, rapid-wave-analyzer.
**Why it happens:** Skills are not part of the build pipeline -- they are separate markdown files.
**How to avoid:** These skills will be rewritten in Phase 43 (planning) and Phase 44 (execution). Phase 41 scope is limited to the build pipeline, role modules, and init skill. The plan-set and execute-set skills are OUT OF SCOPE for this phase -- they will be overhauled in their respective phases.
**Warning signs:** Grep for removed agent names in skills/ shows hits -- but these are expected until Phase 43-44.

### Pitfall 5: Core Agent Stubs Overwriting Existing Files
**What goes wrong:** The stub generation step writes stubs for core agents, but those agents already have full content from the current build.
**Why it happens:** The current build generates ALL agents including core ones with full role content.
**How to avoid:** The stubs should write with the STUB comment prefix. After Phase 41, running `build-agents` will produce stubs for core agents (with TODO role) and full agents for everything else. The existing full-content files for core agents will be replaced by stubs -- this is INTENTIONAL per the design (Phase 42 will hand-write them).
**Warning signs:** If someone is surprised core agents lost their role content, explain this is by design.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Core agent detection | File-level markers or naming conventions | SKIP_GENERATION static array | User decision: sole mechanism is the array |
| Tool doc injection | Custom per-stub tool formatting | Existing `getToolDocsForRole()` | Already handles YAML formatting, token budget, error checking |
| Frontmatter generation | Manual YAML string building | Existing `generateFrontmatter()` | Already handles all 5 fields with fallback defaults |

## Code Examples

### Complete SKIP_GENERATION Build Loop
```javascript
// Source: Derived from rapid-tools.cjs line 694 + CONTEXT.md decisions
const SKIP_GENERATION = ['orchestrator', 'planner', 'executor', 'merger', 'reviewer'];

// Validate SKIP_GENERATION entries
for (const role of SKIP_GENERATION) {
  if (!ROLE_CORE_MAP[role]) {
    error(`SKIP_GENERATION references unknown role "${role}" not in ROLE_CORE_MAP`);
    process.exit(1);
  }
}

const built = [];
const skipped = [];

for (const [role, coreModules] of Object.entries(ROLE_CORE_MAP)) {
  if (SKIP_GENERATION.includes(role)) {
    skipped.push(role);
    continue;
  }
  const assembled = assembleAgentPrompt(role, coreModules);
  const content = GENERATED_COMMENT + assembled;
  const filePath = path.join(agentsDir, `rapid-${role}.md`);
  fs.writeFileSync(filePath, content, 'utf-8');
  built.push(filePath);
}

// Generate stubs for core agents
const STUB_COMMENT = '<!-- STUB: Core agent -- role section is hand-written in Phase 42 -->\n';
for (const role of SKIP_GENERATION) {
  const coreModules = ROLE_CORE_MAP[role];
  const assembled = assembleStubPrompt(role, coreModules);
  const content = STUB_COMMENT + assembled;
  const filePath = path.join(agentsDir, `rapid-${role}.md`);
  fs.writeFileSync(filePath, content, 'utf-8');
  built.push(filePath); // count stubs in built for file management
}

output(`Built ${built.length - skipped.length} agents (${skipped.length} core skipped) in ${agentsDir}`);
```

Wait -- re-reading the decision: "Build summary shows both counts: Built 22 agents (5 core skipped)". The 22 is the generated count, not including stubs. So stubs should not be counted in "built". Revised:

```javascript
// Summary: only count fully generated agents
output(`Built ${built.length} agents (${skipped.length} core skipped) in ${agentsDir}`);
// Where built only contains the 22 generated agents (not stubs)
```

The stub writing happens separately and is not counted in the "Built" number. The stub files are still written to agents/ for Claude Code discovery.

### Init Skill 6th Researcher Spawn
```markdown
**6. Spawn the **rapid-research-ux** agent with this task:**
` ` `
Research domain conventions and UX patterns for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/UX.md
` ` `
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | None (uses node --test directly) |
| Quick run command | `node --test src/lib/build-agents.test.cjs` |
| Full suite command | `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs src/lib/teams.test.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-03 | SKIP_GENERATION skips 5 core agents; generated agents have `<tools>` section | unit | `node --test src/lib/build-agents.test.cjs` | Exists but needs update |
| AGENT-03 | Build summary shows "Built 22 agents (5 core skipped)" | unit | `node --test src/lib/build-agents.test.cjs` | Needs new test |
| AGENT-04 | Core agent stub files exist with frontmatter + tools + placeholder role | unit | `node --test src/lib/build-agents.test.cjs` | Needs new test |
| AGENT-04 | Core agent stubs are NOT prefixed with GENERATED comment | unit | `node --test src/lib/build-agents.test.cjs` | Needs new test |
| AGENT-06 | research-ux registered in all 4 maps + role module exists | unit | `node --test src/lib/build-agents.test.cjs` | Needs new test |
| AGENT-06 | research-ux NOT in ROLE_TOOL_MAP (no CLI commands) | unit | `node --test src/lib/tool-docs.test.cjs` | Needs update |
| -- | Obsolete roles removed from all registries | unit | `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs` | Needs update |
| -- | teams.test.cjs job-executor tests removed | unit | `node --test src/lib/teams.test.cjs` | Needs update |

### Sampling Rate
- **Per task commit:** `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs`
- **Per wave merge:** `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs src/lib/teams.test.cjs`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] Update `ALL_31_ROLES` array in `build-agents.test.cjs` -> `ALL_27_ROLES` (remove 5, add 1)
- [ ] Update `EXPECTED_ROLE_CORE_MAP` in `build-agents.test.cjs` (remove 5, add 1)
- [ ] Update `generates exactly 31 .md files` assertion -> 27
- [ ] Add tests for SKIP_GENERATION behavior (core agents skipped, stubs written)
- [ ] Add tests for stub file format (STUB comment, frontmatter, tools, placeholder role)
- [ ] Update `tool-docs.test.cjs` expected roles list (remove wave-planner, job-planner, wave-analyzer, job-executor)
- [ ] Update `tool-docs.test.cjs` excluded roles list (remove wave-researcher, add research-ux)
- [ ] Update `teams.test.cjs` to remove job-executor agent registration tests (lines 312-333)

## Sources

### Primary (HIGH confidence)
- `src/bin/rapid-tools.cjs` lines 450-703 -- handleBuildAgents() implementation
- `src/lib/tool-docs.cjs` lines 1-186 -- TOOL_REGISTRY + ROLE_TOOL_MAP + getToolDocsForRole()
- `src/lib/build-agents.test.cjs` -- 12 test cases for build pipeline
- `src/lib/tool-docs.test.cjs` -- 14 test cases for tool docs
- `src/lib/teams.test.cjs` lines 312-333 -- job-executor registration tests
- `skills/init/SKILL.md` lines 377-528 -- init research pipeline (Step 7-8)
- `src/modules/roles/role-research-synthesizer.md` -- synthesizer role with 5-file input list
- `src/modules/PROMPT-SCHEMA.md` -- XML tag schema and assembly order
- `.planning/phases/41-build-pipeline-generated-agents/41-CONTEXT.md` -- all locked decisions

### Secondary (MEDIUM confidence)
- Role module patterns derived from reading 5 existing research role modules

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all code examined directly, no external dependencies
- Architecture: HIGH - build pipeline is well-documented with clear patterns
- Pitfalls: HIGH - test files enumerate exact expectations, easy to verify correctness

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable internal codebase, no external dependencies)
