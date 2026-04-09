# PLAN: research-agent-reduction / Wave 1

## Objective

Transform the `/rapid:new-version` research pipeline from a hardcoded 6-agent spawn into a dynamically selected subset. The orchestrator will semantically analyze milestone goals to decide which of the 6 research agents are relevant, spawn only those, and pass a dynamic file list to the synthesizer. All 6 agent prompts remain unchanged; only the orchestration framing, synthesizer input, description, constraints, and anti-pattern rules are modified.

All changes target a single file: `skills/new-version/SKILL.md`.

## Tasks

### Task 1: Update frontmatter description and prose intro (Lines 2, 8)

**File:** `skills/new-version/SKILL.md`

**Action:** Two edits in the first 10 lines.

1. **Line 2** -- Change the description frontmatter from:
   ```
   description: Complete current milestone and start a new version with 6-researcher pipeline and roadmap generation
   ```
   to:
   ```
   description: Complete current milestone and start a new version with adaptive research pipeline and roadmap generation
   ```

2. **Line 8** -- Change the prose intro from:
   ```
   ...re-running the 6-researcher > synthesizer > roadmapper pipeline for new scope.
   ```
   to:
   ```
   ...re-running the adaptive research > synthesizer > roadmapper pipeline for new scope.
   ```

**What NOT to do:** Do not change the skill name, the allowed-tools line, or any other frontmatter field. Only the description value and the line 8 prose change.

**Verification:**
```bash
head -10 skills/new-version/SKILL.md | grep -c "6-researcher"
# Expected: 0 (no remaining references to "6-researcher")
head -10 skills/new-version/SKILL.md | grep -c "adaptive research"
# Expected: 2 (one in frontmatter, one in prose)
```

---

### Task 2: Add Step 5A -- Agent Selection Reasoning (before current Line 408)

**File:** `skills/new-version/SKILL.md`

**Action:** Replace the current Step 5 opening (lines 406-415) with a restructured Step 5 that has two sub-steps: 5A (selection reasoning) and 5B (conditional spawning).

Replace the current text:
```
## Step 5: Run Research Pipeline

Spawn ALL 6 research agents in parallel to explore the new milestone's scope. Use the milestone goals from Step 2 as the research context.

Ensure `.planning/research/` exists:

\`\`\`bash
mkdir -p .planning/research
\`\`\`
```

With this replacement:
```
## Step 5: Run Research Pipeline

Analyze milestone goals and selectively spawn research agents to explore the new milestone's scope. Use the milestone goals from Step 2 as the research context.

Ensure `.planning/research/` exists:

\`\`\`bash
mkdir -p .planning/research
\`\`\`

### Step 5A: Agent Selection

Before spawning any agents, analyze the category-tagged goals from Step 2C-vi and determine which research domains are relevant. The 6 available research agents are:

| # | Agent | Domain | Spawn when... |
|---|-------|--------|---------------|
| 1 | rapid-research-stack | Technology stack, dependencies, compatibility | Goals mention new dependencies, framework changes, runtime upgrades, or tooling changes |
| 2 | rapid-research-features | Feature decomposition, implementation strategies | Goals include new features, capability additions, or significant behavior changes |
| 3 | rapid-research-architecture | Architectural patterns, module organization | Goals involve structural changes, new modules, data flow redesign, or cross-cutting refactors |
| 4 | rapid-research-pitfalls | Failure modes, anti-patterns, security/perf traps | Goals touch areas with known risk (security, performance, concurrency, migrations) |
| 5 | rapid-research-oversights | Edge cases, cross-cutting concerns, blind spots | Goals span multiple subsystems or introduce new integration surfaces |
| 6 | rapid-research-ux | Domain conventions, UX/DX patterns | Goals include user-facing changes, CLI/UI modifications, or workflow changes |

**Selection process:**

1. Read each goal category (features, bugFixes, techDebt, uxImprovements, deferredDecisions, additionalGoals).
2. For each of the 6 agents, reason about whether the milestone goals overlap with that agent's domain.
3. When uncertain whether an agent is relevant, err on the side of spawning it (preserve depth over efficiency).
4. Produce a selection list with brief justification for each included and excluded agent.

**Display the selection to the user:**

```
## Research Agent Selection

Based on milestone goals, spawning {N}/6 research agents:

{For each SELECTED agent:}
- [SELECTED] {agent name}: {one-line justification}

{For each EXCLUDED agent:}
- [SKIPPED] {agent name}: {one-line justification for exclusion}
```

**Minimum agents:** At least 1 agent must be selected. If analysis suggests 0 agents are needed, select all 6 as a fallback (the milestone goals may be too abstract to filter).

**All 6 selected is valid.** If all goals are broad or the milestone is large, selecting all 6 is the correct outcome. Do not artificially reduce count.

Store the selected agent list as `selectedAgents` (an array of agent identifiers: "stack", "features", "architecture", "pitfalls", "oversights", "ux") and the corresponding output file paths as `selectedResearchFiles`.

### Step 5B: Spawn Selected Agents
```

**What NOT to do:**
- Do not modify any of the 6 individual agent spawn prompts (items 1-6 below Step 5B). They remain exactly as-is.
- Do not add an AskUserQuestion for agent selection -- the orchestrator decides, displays, and proceeds.
- Do not use keyword matching or regex for selection -- it must be semantic reasoning over goal content.

**Verification:**
```bash
grep -c "Step 5A: Agent Selection" skills/new-version/SKILL.md
# Expected: 1
grep -c "Step 5B: Spawn Selected Agents" skills/new-version/SKILL.md
# Expected: 1
grep -c "Spawn ALL 6" skills/new-version/SKILL.md
# Expected: 0
```

---

### Task 3: Make agent spawning conditional (Line 416 area and Line 566 area)

**File:** `skills/new-version/SKILL.md`

**Action:** Two edits around the spawn instructions.

1. **Before each agent spawn block (items 1-6),** the current text reads like `**1. Spawn the **rapid-research-stack** agent with this task:**`. Add a conditional wrapper instruction before the first agent spawn block (item 1). Replace the current intro pattern.

   Right after the new `### Step 5B: Spawn Selected Agents` heading (from Task 2), add:

   ```
   For each agent in `selectedAgents`, spawn that agent using the corresponding prompt below. Skip agents not in `selectedAgents`.
   ```

   The 6 numbered agent spawn blocks (items 1-6) remain exactly as written. The conditional logic is in the framing text, not in each block.

2. **Replace the parallel spawning instruction** (line 566 area). Change:
   ```
   **Parallel spawning:** Spawn all 6 agents in a single response using 6 Agent tool calls.

   **Sequential fallback:** If parallel spawning fails (Claude Code limitation), fall back to sequential execution. Inform the user: "Running research agents sequentially (parallel spawning unavailable)."

   Wait for ALL 6 agents to complete. If any agent fails, use AskUserQuestion:
   ```
   to:
   ```
   **Parallel spawning:** Spawn all selected agents in a single response using one Agent tool call per selected agent.

   **Sequential fallback:** If parallel spawning fails (Claude Code limitation), fall back to sequential execution. Inform the user: "Running research agents sequentially (parallel spawning unavailable)."

   Wait for all selected agents to complete. If any agent fails, use AskUserQuestion:
   ```

**What NOT to do:**
- Do not add if/else blocks around each individual agent prompt. The conditional is a single framing instruction before the block of 6.
- Do not modify the content of any agent prompt (the text inside the ``` blocks).

**Verification:**
```bash
grep -c "Spawn all 6 agents" skills/new-version/SKILL.md
# Expected: 0
grep -c "all selected agents" skills/new-version/SKILL.md
# Expected: 1
grep -c "Wait for ALL 6" skills/new-version/SKILL.md
# Expected: 0
grep -c "Wait for all selected agents" skills/new-version/SKILL.md
# Expected: 1
```

---

### Task 4: Update Step 6 synthesizer prompt for dynamic file list (Lines 579-599)

**File:** `skills/new-version/SKILL.md`

**Action:** Replace the hardcoded 6-file list in the synthesizer prompt with a dynamic reference. Change the Step 6 synthesizer task prompt from:

```
Synthesize all research outputs into a unified research summary for milestone '{milestoneId}'.

## Research Files to Read
- .planning/research/{milestoneId}-research-stack.md
- .planning/research/{milestoneId}-research-features.md
- .planning/research/{milestoneId}-research-architecture.md
- .planning/research/{milestoneId}-research-pitfalls.md
- .planning/research/{milestoneId}-research-oversights.md
- .planning/research/{milestoneId}-research-ux.md

## Working Directory
{projectRoot}

## Output
Write synthesized summary to .planning/research/{milestoneId}-synthesis.md
```

to:

```
Synthesize all research outputs into a unified research summary for milestone '{milestoneId}'.

## Research Files to Read
{List each file path from `selectedResearchFiles` as a bullet point. Only include files that were actually generated by the selected agents in Step 5B.}

**Note:** This milestone used {N} of 6 available research agents. Synthesize from the files listed above. If fewer than 6 files are present, that is expected -- do not treat missing domains as errors. Focus synthesis on the research that was conducted.

## Working Directory
{projectRoot}

## Output
Write synthesized summary to .planning/research/{milestoneId}-synthesis.md
```

**What NOT to do:**
- Do not change the synthesizer agent name (`rapid-research-synthesizer`).
- Do not modify the output path or the text around the synthesizer prompt (the "Wait for completion" paragraph, the error handling, etc.).
- Do not add domain-specific logic to the synthesizer prompt -- keep it generic.

**Verification:**
```bash
grep -c "research-stack.md" skills/new-version/SKILL.md
# Expected: 1 (only in the agent spawn prompt for stack, NOT in synthesizer)
grep -c "selectedResearchFiles" skills/new-version/SKILL.md
# Expected: at least 1 (in synthesizer prompt)
grep -c "of 6 available research agents" skills/new-version/SKILL.md
# Expected: 1
```

---

### Task 5: Update Important Constraints section (Line 764)

**File:** `skills/new-version/SKILL.md`

**Action:** Replace the constraint about agent independence. Change:

```
- **All 6 research agents are independent.** No research agent reads another research agent's output. They only share the milestone brief and brownfield analysis as inputs.
```

to:

```
- **All research agents are independent.** Selected agents do not read each other's output. They share only the milestone brief and brownfield analysis as inputs. The number of agents spawned varies per milestone based on goal analysis.
```

**Verification:**
```bash
grep -c "All 6 research agents" skills/new-version/SKILL.md
# Expected: 0
grep -c "All research agents are independent" skills/new-version/SKILL.md
# Expected: 1
```

---

### Task 6: Update Anti-Patterns section (Lines 782-783)

**File:** `skills/new-version/SKILL.md`

**Action:** Replace the two hardcoded-6 anti-patterns with dynamic-selection rules. Remove these two lines:

```
- Do NOT spawn only 5 researchers -- MUST spawn all 6 (stack, features, architecture, pitfalls, oversights, ux).
- Do NOT skip the UX researcher (rapid-research-ux) -- it is required for complete research coverage matching /init.
```

And replace with these three lines:

```
- Do NOT skip agents without explicit reasoning -- every excluded agent must have a logged justification in Step 5A.
- Do NOT use keyword matching or category-to-agent mapping for agent selection -- use semantic analysis of goal content.
- Do NOT artificially reduce agent count -- when uncertain, err on the side of spawning the agent to preserve research depth.
```

**What NOT to do:**
- Do not remove any other anti-pattern entries. Only the two lines about "spawn all 6" and "skip UX researcher" are replaced.
- Do not add more than 3 replacement lines -- keep the section concise.

**Verification:**
```bash
grep -c "MUST spawn all 6" skills/new-version/SKILL.md
# Expected: 0
grep -c "skip the UX researcher" skills/new-version/SKILL.md
# Expected: 0
grep -c "explicit reasoning" skills/new-version/SKILL.md
# Expected: 1
grep -c "keyword matching" skills/new-version/SKILL.md
# Expected: 1
grep -c "artificially reduce" skills/new-version/SKILL.md
# Expected: 1
```

---

### Task 7: Final validation

**File:** `skills/new-version/SKILL.md`

**Action:** Run a comprehensive validation pass to ensure consistency across all edits.

**Verification commands:**

```bash
# 1. No remaining hardcoded "6-researcher" references in description/intro
head -10 skills/new-version/SKILL.md | grep -c "6-researcher"
# Expected: 0

# 2. No remaining "Spawn ALL 6" or "all 6 agents" in Step 5
grep -ic "spawn all 6\|all 6 agents\|all 6 research" skills/new-version/SKILL.md
# Expected: 0

# 3. Step 5A and 5B exist
grep -c "Step 5A" skills/new-version/SKILL.md
# Expected: 1
grep -c "Step 5B" skills/new-version/SKILL.md
# Expected: 1

# 4. selectedResearchFiles referenced in synthesizer
grep -c "selectedResearchFiles" skills/new-version/SKILL.md
# Expected: at least 1

# 5. All 6 agent spawn prompts still present (unchanged)
grep -c "rapid-research-stack" skills/new-version/SKILL.md
# Expected: at least 1
grep -c "rapid-research-features" skills/new-version/SKILL.md
# Expected: at least 1
grep -c "rapid-research-architecture" skills/new-version/SKILL.md
# Expected: at least 1
grep -c "rapid-research-pitfalls" skills/new-version/SKILL.md
# Expected: at least 1
grep -c "rapid-research-oversights" skills/new-version/SKILL.md
# Expected: at least 1
grep -c "rapid-research-ux" skills/new-version/SKILL.md
# Expected: at least 1

# 6. No "MUST spawn all 6" anti-pattern remains
grep -c "MUST spawn all 6" skills/new-version/SKILL.md
# Expected: 0

# 7. Dynamic selection anti-patterns present
grep -c "semantic analysis" skills/new-version/SKILL.md
# Expected: at least 1

# 8. File still parseable as valid Markdown frontmatter
head -4 skills/new-version/SKILL.md | grep -c "^---$"
# Expected: 2
```

**Success criteria:** All verification commands return expected values. The file is internally consistent -- no stale references to "6 agents" remain outside the individual agent prompt blocks (where the number "6" does not appear).

---

## Success Criteria

1. The description and intro no longer say "6-researcher pipeline"
2. Step 5 has a new sub-step 5A that performs semantic agent selection with logged reasoning
3. Step 5B conditionally spawns only selected agents
4. All 6 individual agent spawn prompts remain unchanged
5. The synthesizer prompt accepts a dynamic file list instead of hardcoded 6 paths
6. The Important Constraints section reflects dynamic agent count
7. The Anti-Patterns section enforces semantic selection instead of mandatory-6
8. All Task 7 verification commands pass
