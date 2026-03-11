# Phase 36: README Rewrite - Research

**Researched:** 2026-03-11
**Domain:** Technical documentation (GitHub README.md authoring)
**Confidence:** HIGH

## Summary

Phase 36 is a documentation-only phase: rewrite README.md from scratch to accurately describe RAPID's current capabilities through v2.2. The primary research questions are: (1) what is the accurate current state of RAPID's skills, agents, and architecture, (2) what are the best practices for GitHub README rendering with Unicode box-drawing diagrams and collapsible sections, and (3) what command argument syntax is correct for each of the 18 skills.

All source material is available in the repository itself (skills/, agents/, DOCS.md, plugin.json). The DOCS.md file (979 lines, versioned at v2.0.0) is the richest reference but is outdated -- it does not cover v2.1 or v2.2 changes (set-based review, plan-set skill, wave orchestration improvements, subagent merge delegation, adaptive conflict resolution, conflict-resolver agent). The 18 skill SKILL.md files and 31 agent files are the canonical sources of truth.

**Primary recommendation:** Build the README by extracting facts from the canonical sources (skill files, agent files, DOCS.md) rather than writing from memory. Every command reference entry must be verified against the corresponding SKILL.md file for argument syntax.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Concept-explanation-first layout (not action-first): open with what RAPID is and why, then how, then quick start and commands
- Command reference table shows name + argument syntax + short description (e.g., `/rapid:set-init <set-id>`)
- Describe current state only -- no version callouts, changelogs, or "What's New" sections
- Reference technical_documentation.md as the canonical power-user doc -- drop DOCS.md references (it's outdated at v2.0)
- 18 skills exist: assumptions, cleanup, context, discuss, execute, help, init, install, merge, new-milestone, pause, plan, plan-set, resume, review, set-init, status, wave-plan
- Quick start covers both greenfield and brownfield paths with clear separation
- Each quick start step shows command + what happens (not just a one-liner)
- Steps grouped by phase: "Project Setup", "Per-Set Development", "Finalization"
- Show the team angle: parallel sets across developers
- One combined architecture diagram showing Sets/Waves/Jobs hierarchy AND agent dispatch pattern
- Key agents only (~5-7) in diagram: orchestrator, executor, reviewer, merger, plus a few notable ones
- Include merge pipeline's subagent delegation: orchestrator -> set-merger -> conflict-resolver nesting
- Use Unicode box-drawing characters for diagram (primary viewing context is GitHub)
- Primary audience: both newcomers AND Claude Code power users -- layered
- Conversational-technical tone -- friendly but precise (Vercel/Astro docs style)
- Problem-first opening: start with the pain of multiple Claude Code users stepping on each other

### Claude's Discretion
- Exact section ordering beyond the top-level structure
- How to implement the greenfield/brownfield tab separation in Markdown (HTML details tags, headers, etc.)
- Specific wording of the problem-first opening
- Which ~5-7 agents to highlight in the diagram
- Whether to include a Features section or let the conceptual section + diagram cover it

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | README.md rewritten from scratch reflecting all capabilities through v2.2 with accurate command reference | Complete inventory of 18 skills with descriptions and argument syntax; complete inventory of 31 agents; DOCS.md as reference for detailed descriptions; v2.2 capability list verified |
| DOC-02 | README.md includes full lifecycle quick start (init through cleanup) and ASCII architecture diagram | Workflow lifecycle documented in DOCS.md; diagram rendering research (Unicode box-drawing in GitHub code blocks); collapsible section syntax for greenfield/brownfield tabs |
</phase_requirements>

## Standard Stack

This phase produces a single Markdown file (README.md). No libraries or dependencies are involved.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Flavored Markdown | N/A | README authoring format | GitHub renders README.md automatically as repo landing page |
| HTML `<details>`/`<summary>` | HTML5 | Collapsible sections for greenfield/brownfield paths | Natively supported by GitHub, no JS/CSS needed |
| Unicode box-drawing chars | N/A | Architecture diagram lines | User decision: clean lines in code blocks (U+2500 series) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Unicode box-drawing | Mermaid diagrams | Mermaid renders as SVG on GitHub (interactive), but user locked Unicode box-drawing decision. Mermaid also cannot show the exact layout flexibility needed for a combined hierarchy+dispatch diagram. |
| `<details>` tags | Separate headers (### Greenfield / ### Brownfield) | Details tags are collapsible but require blank lines around Markdown content inside HTML. Headers are simpler but take more vertical space. Claude's discretion per CONTEXT.md. |

## Architecture Patterns

### README Section Structure (from locked decisions)

```
README.md
├── Problem-first opening (pain of parallel Claude Code users)
├── What is RAPID (one-liner + paragraph)
├── How It Works (2-3 paragraphs: Sets/Waves/Jobs model)
├── Architecture Diagram (combined hierarchy + agent dispatch)
├── Quick Start
│   ├── Prerequisites
│   ├── Installation
│   ├── Project Setup (greenfield / brownfield paths)
│   ├── Per-Set Development (the parallel loop)
│   └── Finalization (merge, cleanup)
├── Command Reference (18-row table)
├── [Optional] Features section (Claude's discretion)
├── Further Reading → technical_documentation.md
└── License
```

### Pattern 1: Collapsible Greenfield/Brownfield Sections
**What:** Use `<details>` + `<summary>` HTML tags to create expandable sections
**When to use:** For the quick start greenfield vs brownfield paths
**Example:**
```html
<details>
<summary><strong>Greenfield (new project)</strong></summary>

<!-- IMPORTANT: blank line required before Markdown content -->

1. `/rapid:init` -- ...
2. `/rapid:plan` -- ...

</details>

<details open>
<summary><strong>Brownfield (existing codebase)</strong></summary>

1. `/rapid:init` -- ...
2. `/rapid:context` -- ...
3. `/rapid:plan` -- ...

</details>
```
**Source:** [GitHub Docs - Organizing information with collapsed sections](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections)

### Pattern 2: Unicode Box-Drawing Diagram in Code Block
**What:** Use a fenced code block (no language tag) containing Unicode box-drawing characters
**When to use:** The architecture diagram
**Rendering notes:**
- GitHub renders code blocks in monospace font (SFMono-Regular, Consolas, Liberation Mono, Menlo)
- Unicode box-drawing characters (U+2500 series: `─`, `│`, `┌`, `┐`, `└`, `┘`, `├`, `┤`, `┬`, `┴`, `┼`) render correctly in these monospace fonts
- Known issue: some browsers/font stacks may render box-drawing chars at slightly different widths. Using a plain code block (no language specifier) gives the most consistent rendering.
- Keep diagram width under 80 characters for mobile viewport compatibility
- Use ```` ```text ```` or ```` ``` ```` (no language) for best results

**Important:** There is a long-standing GitHub issue about line spacing in code blocks making ASCII art look stretched. The diagram should be tested by viewing the README on GitHub after pushing. Keeping the diagram compact (under 25 lines) mitigates visual issues.

### Anti-Patterns to Avoid
- **Stale command names/args:** Referencing commands that don't match SKILL.md files. Every command entry must be cross-checked.
- **Version-specific callouts:** Per locked decision, describe current state only. No "New in v2.2" badges.
- **Referencing DOCS.md:** Per locked decision, reference technical_documentation.md instead (Phase 37 will create it). The reference should note the file even though it won't exist yet.
- **Listing all 31 agents:** The diagram should show 5-7 key agents. The full agent list belongs in technical_documentation.md.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Greenfield/brownfield tabs | Custom CSS or JavaScript | `<details>`/`<summary>` HTML tags | Natively supported by GitHub, zero dependencies |
| Architecture diagram | External image or Mermaid | Unicode box-drawing in fenced code block | User decision; works offline, no rendering dependencies |
| Command reference | Manual typing from memory | Extract from SKILL.md `description:` frontmatter | Single source of truth; prevents drift |

## Common Pitfalls

### Pitfall 1: Blank Line Requirement Inside `<details>` Tags
**What goes wrong:** Markdown inside `<details>` renders as raw text instead of formatted Markdown
**Why it happens:** GitHub's Markdown parser requires a blank line between HTML tags and Markdown content
**How to avoid:** Always include a blank line after `<summary>` closing tag and before Markdown content
**Warning signs:** Bullet points or headings rendering as literal `*` or `#` characters

### Pitfall 2: Box-Drawing Character Alignment
**What goes wrong:** Diagram lines don't connect properly, corners misalign
**Why it happens:** Mixing regular ASCII characters with Unicode box-drawing, or using characters with inconsistent widths
**How to avoid:** Use ONLY box-drawing characters from U+2500 block for lines/corners. Use regular ASCII for labels inside boxes. Test on GitHub after push.
**Warning signs:** Lines that look right in editor but break on GitHub

### Pitfall 3: Outdated Command Information from DOCS.md
**What goes wrong:** README documents v2.0 behavior instead of v2.2 behavior
**Why it happens:** DOCS.md is version 2.0.0 and has not been updated for v2.1/v2.2 changes
**How to avoid:** Cross-reference DOCS.md descriptions with actual SKILL.md files. Key differences:
- `/rapid:review` no longer accepts wave-id argument (SET-REVIEW-02, v2.1)
- `/rapid:merge` now uses subagent delegation per set (MERGE-01, v2.2)
- `/rapid:merge` includes adaptive conflict resolution via resolver agents (MERGE-06, v2.2)
- `/rapid:plan-set` is a newer skill not fully documented in DOCS.md
- Agent count is now 31 (was 26 in DOCS.md; v2.2 added conflict-resolver, set-merger, wave-analyzer, scoper, plan-verifier)
**Warning signs:** Descriptions mentioning "wave-level review" or "inline merge processing"

### Pitfall 4: Wrong Argument Syntax
**What goes wrong:** Command reference shows arguments that skills don't actually accept
**Why it happens:** Skills evolved since DOCS.md was written; argument syntax changed
**How to avoid:** Use the verified argument table in the Code Examples section below

### Pitfall 5: Mobile/Narrow Viewport Diagram Overflow
**What goes wrong:** Architecture diagram requires horizontal scrolling on mobile
**Why it happens:** Diagram wider than ~80 characters
**How to avoid:** Keep diagram under 80 characters wide. Use abbreviations in labels if needed.

## Code Examples

### Verified Command Reference Table (from SKILL.md files)

This table was built by examining each SKILL.md file's frontmatter `description:` field and argument handling code. This is the canonical reference for the README.

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/rapid:install` | (none) | One-time setup: configure shell and environment |
| `/rapid:init` | (none) | Research project, generate roadmap, scaffold `.planning/` |
| `/rapid:context` | (none) | Analyze existing codebase and generate context files |
| `/rapid:plan` | (none) | Decompose work into parallelizable sets with contracts |
| `/rapid:plan-set` | `<set-id>` | Plan all waves in a set with automatic sequencing |
| `/rapid:assumptions` | `<set-id>` | Surface assumptions about a set before execution |
| `/rapid:set-init` | `<set-id>` | Create worktree and branch for a set |
| `/rapid:discuss` | `<wave-id>` or `<set-id> <wave-id>` | Capture implementation vision for a wave |
| `/rapid:wave-plan` | `<wave-id>` or `<set-id> <wave-id>` | Research, plan waves, plan jobs |
| `/rapid:execute` | `<set-id>` or `<set-id> --fix-issues` | Run jobs in parallel per wave |
| `/rapid:review` | `<set-id>` | Unit test + bug hunt + UAT pipeline |
| `/rapid:merge` | (none) or `<set-id>` | Merge completed sets into main |
| `/rapid:cleanup` | `<set-id>` | Remove worktrees and optionally delete branches |
| `/rapid:pause` | `<set-id>` | Save set state for later resumption |
| `/rapid:resume` | `<set-id>` | Resume a paused set |
| `/rapid:status` | (none) | Cross-set progress dashboard |
| `/rapid:new-milestone` | (none) | Archive current milestone, re-plan new scope |
| `/rapid:help` | (none) | Command reference and workflow guide |

**Confidence:** HIGH -- every entry verified against the corresponding `skills/<name>/SKILL.md` file.

**Notes:**
- Arguments accepting `<set-id>` support both full string IDs (e.g., `auth-system`) and numeric indices (e.g., `1`)
- Arguments accepting `<wave-id>` support dot notation (e.g., `1.1` = set 1, wave 1), wave string IDs, or `<set-id> <wave-id>` two-argument form

### Verified Agent Inventory (31 agents)

Full list from `agents/` directory:

| Agent | Purpose | Spawned By |
|-------|---------|------------|
| rapid-orchestrator | Top-level workflow coordination | `/rapid:execute` |
| rapid-planner | Decomposes work into parallelizable sets | `/rapid:plan` |
| rapid-set-planner | Set-level implementation approach | `/rapid:set-init` |
| rapid-wave-analyzer | Wave dependency detection | `/rapid:plan-set` |
| rapid-wave-researcher | Implementation-specific research for a wave | `/rapid:wave-plan` |
| rapid-wave-planner | Per-job wave plan production | `/rapid:wave-plan` |
| rapid-job-planner | Detailed per-job implementation plan | `/rapid:wave-plan` |
| rapid-plan-verifier | Validates job plans for coverage/consistency | `/rapid:wave-plan` |
| rapid-job-executor | Implements a single job within a wave | `/rapid:execute` |
| rapid-executor | Set-level task implementation (v1 compat) | `/rapid:execute` |
| rapid-verifier | Filesystem artifact verification | `/rapid:execute` |
| rapid-unit-tester | Generates and runs unit tests | `/rapid:review` |
| rapid-bug-hunter | Static analysis with risk scoring | `/rapid:review` |
| rapid-devils-advocate | Challenges bug findings with counter-evidence | `/rapid:review` |
| rapid-judge | Final ACCEPTED/DISMISSED/DEFERRED rulings | `/rapid:review` |
| rapid-bugfix | Fixes accepted bugs | `/rapid:execute --fix-issues` |
| rapid-uat | Acceptance testing with browser automation | `/rapid:review` |
| rapid-scoper | Categorizes files by concern for review | `/rapid:review` |
| rapid-reviewer | Deep code review for merge readiness | `/rapid:merge` |
| rapid-merger | Semantic conflict detection + AI resolution | `/rapid:merge` |
| rapid-set-merger | Per-set merge orchestration (subagent) | `/rapid:merge` |
| rapid-conflict-resolver | Deep analysis of mid-confidence conflicts | `/rapid:merge` |
| rapid-codebase-synthesizer | Deep brownfield analysis | `/rapid:init` |
| rapid-context-generator | Produces project context documents | `/rapid:context` |
| rapid-research-stack | Technology stack research | `/rapid:init` |
| rapid-research-features | Feature implementation research | `/rapid:init` |
| rapid-research-architecture | Architecture pattern research | `/rapid:init` |
| rapid-research-pitfalls | Common pitfalls research | `/rapid:init` |
| rapid-research-oversights | Cross-cutting concern research | `/rapid:init` |
| rapid-research-synthesizer | Combines 5 research outputs | `/rapid:init` |
| rapid-roadmapper | Creates project roadmap | `/rapid:init` |

### Recommended ~5-7 Agents for Diagram

Based on the user wanting to show the hierarchy AND agent dispatch pattern, with merge pipeline nesting:

1. **rapid-orchestrator** -- central dispatch hub during execution
2. **rapid-job-executor** -- the actual implementation agent (parallel within waves)
3. **rapid-planner** -- decomposes project into sets
4. **rapid-reviewer** / **rapid-scoper** -- review pipeline representative
5. **rapid-set-merger** -- per-set merge delegation (v2.2 feature)
6. **rapid-conflict-resolver** -- nested under set-merger (v2.2 feature, shows nesting)
7. (Optional) **rapid-wave-planner** or **rapid-research-**** -- planning/research representative

This set covers all major workflow stages (plan, execute, review, merge) and demonstrates the subagent delegation nesting that is a v2.2 differentiator.

### Diagram Sketch (Unicode Box-Drawing)

A possible combined diagram (~25 lines, under 80 chars):

```
┌─────────────────────────────────────────────────────────┐
│                      RAPID Project                      │
│                                                         │
│  ┌─────────────────── Milestone ──────────────────┐     │
│  │                                                 │     │
│  │  ┌── Set 1 ──┐  ┌── Set 2 ──┐  ┌── Set 3 ──┐ │     │
│  │  │ Wave 1    │  │ Wave 1    │  │ Wave 1    │ │     │
│  │  │  Job A    │  │  Job D    │  │  Job G    │ │     │
│  │  │  Job B    │  │  Job E    │  │  Job H    │ │     │
│  │  │ Wave 2    │  │ Wave 2    │  └───────────┘ │     │
│  │  │  Job C    │  │  Job F    │   Developer C  │     │
│  │  └───────────┘  └───────────┘                │     │
│  │   Developer A    Developer B                  │     │
│  └─────────────────────────────────────────────────┘     │
│                                                         │
│  Agent Dispatch:                                        │
│  orchestrator ──┬── job-executor (parallel per job)     │
│                 ├── scoper + reviewer (review pipeline) │
│                 └── set-merger ── conflict-resolver      │
│                      (per set)     (per conflict)       │
└─────────────────────────────────────────────────────────┘
```

**Note:** This is a starting sketch. The planner should refine it. Key principle: the top half shows the hierarchy (Milestone > Sets > Waves > Jobs), the bottom half shows agent dispatch with nesting. This keeps it under 25 lines and under 80 chars.

### Workflow Lifecycle (Quick Start Phases)

Grouped per the locked decision:

**Project Setup:**
1. `/rapid:install` -- one-time shell/environment setup
2. `/rapid:init` -- research + roadmap + scaffold
3. `/rapid:context` -- (brownfield only) codebase analysis
4. `/rapid:plan` -- decompose into sets

**Per-Set Development (parallel across developers):**
5. `/rapid:set-init <set-id>` -- create worktree
6. `/rapid:discuss <wave-id>` -- capture vision (per wave)
7. `/rapid:wave-plan <wave-id>` -- research + plan (per wave)
8. `/rapid:execute <set-id>` -- run jobs (all waves)
9. `/rapid:review <set-id>` -- quality pipeline

**Finalization:**
10. `/rapid:merge` -- merge all completed sets
11. `/rapid:cleanup <set-id>` -- remove worktrees
12. `/rapid:new-milestone` -- start next cycle

### Problem-First Opening Inspiration

The user wants to start with the pain: "multiple Claude Code users stepping on each other." Key pain points to articulate:
- Merge conflicts from uncoordinated parallel work
- Context pollution (one agent's changes confuse another)
- No file ownership, so agents overwrite each other
- No structured merge strategy for AI-generated code
- No review pipeline to catch cross-agent inconsistencies

### Reference: technical_documentation.md

The README should reference `technical_documentation.md` as the power-user doc. This file will be created in Phase 37 (DOC-03, DOC-04, DOC-05). The README reference should be something like:

```markdown
For detailed configuration, all 31 agent roles, state machine documentation, and troubleshooting, see [technical_documentation.md](technical_documentation.md).
```

This is a forward reference -- the file won't exist when Phase 36 ships. That's acceptable per the CONTEXT.md note ("file won't exist yet at time of this phase").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Wave-level review (`/review <set> <wave>`) | Set-level review (`/review <set>`) | v2.1 (Phase 29.1) | Wave argument is ignored with a note |
| Inline merge processing | Subagent delegation per set | v2.2 (Phase 34) | Orchestrator spawns rapid-set-merger subagents |
| Binary confidence routing in merge | Adaptive conflict resolution (3 bands) | v2.2 (Phase 35) | <0.3 human, 0.3-0.8 resolver-agent, >0.8 auto-accept |
| 26 agent roles | 31 agent roles | v2.1-v2.2 | Added: set-merger, conflict-resolver, wave-analyzer, scoper, plan-verifier |
| DOCS.md as primary reference | technical_documentation.md (Phase 37) | v2.2 (this phase) | DOCS.md (v2.0) is outdated; new canonical reference |
| 17 skills | 18 skills | v2.1 (Phase 31) | Added: plan-set |

**Deprecated/outdated:**
- **DOCS.md**: v2.0.0, does not cover v2.1/v2.2 changes. Being replaced by technical_documentation.md.
- **`/rapid:review <set-id> <wave-id>`**: Wave argument is deprecated; review runs at set level only.

## Open Questions

1. **How will the `technical_documentation.md` forward reference render?**
   - What we know: The file won't exist when Phase 36 ships. GitHub will render it as a broken link.
   - What's unclear: Whether to add a note like "(coming soon)" or just let the link be.
   - Recommendation: Add the link anyway with a parenthetical note. Phase 37 will create the target.

2. **Box-drawing diagram: test on GitHub before finalizing?**
   - What we know: Unicode box-drawing renders in monospace code blocks but there are known spacing issues.
   - What's unclear: Exact rendering in the repo's GitHub page.
   - Recommendation: After writing, push a draft and visually check on GitHub. Adjust character alignment if needed.

3. **Should `<details>` default to open or closed?**
   - What we know: GitHub supports the `open` attribute on `<details>`. Brownfield is likely the more common path.
   - What's unclear: User preference for default state.
   - Recommendation: Both open by default, or greenfield open (simpler path first). Claude's discretion per CONTEXT.md.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual validation (documentation phase) |
| Config file | N/A |
| Quick run command | Visual inspection of rendered README |
| Full suite command | `gh repo view --web` after push to check rendering |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | README.md rewritten with accurate command reference | manual-only | Cross-reference each command row against `skills/<name>/SKILL.md` description frontmatter | N/A |
| DOC-02 | Quick start lifecycle + ASCII architecture diagram | manual-only | Visual inspection of README on GitHub for diagram rendering and walkthrough completeness | N/A |

**Justification for manual-only:** This phase produces a single Markdown file. There is no executable code to unit test. Validation is inherently visual (does the README render correctly?) and factual (does each command match its SKILL.md?). The verification step should be a systematic cross-check rather than automated testing.

### Sampling Rate
- **Per task commit:** Review rendered Markdown locally or via `grip` (GitHub Readme Instant Preview)
- **Per wave merge:** Push to a branch and view on GitHub
- **Phase gate:** Visual inspection on GitHub + command reference cross-check against SKILL.md files

### Wave 0 Gaps
None -- no test infrastructure needed for a documentation-only phase.

## Sources

### Primary (HIGH confidence)
- `skills/*/SKILL.md` (18 files) -- Canonical command descriptions, argument syntax, and behavior
- `agents/*.md` (31 files) -- Canonical agent inventory with YAML frontmatter descriptions
- `DOCS.md` (979 lines, v2.0.0) -- Detailed command reference and architecture (partially outdated)
- `.claude-plugin/plugin.json` -- Plugin version and metadata
- `.planning/REQUIREMENTS.md` -- DOC-01, DOC-02 requirement definitions
- `.planning/STATE.md` -- Current project state and version history

### Secondary (MEDIUM confidence)
- [GitHub Docs - Organizing information with collapsed sections](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections) -- `<details>`/`<summary>` tag support
- [GitHub Docs - Creating diagrams](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams) -- Mermaid and diagram support
- [GitHub Blog - Include diagrams in Markdown with Mermaid](https://github.blog/developer-skills/github/include-diagrams-markdown-files-mermaid/) -- Mermaid in README (alternative to box-drawing, not used per user decision)

### Tertiary (LOW confidence)
- [GitHub markup issue #334](https://github.com/github/markup/issues/334) -- ASCII art rendering in code blocks (open issue about line spacing)
- WebSearch on Unicode box-drawing rendering -- multiple sources report font-dependent rendering; mitigated by using plain code blocks

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no libraries needed, just Markdown + HTML
- Architecture: HIGH -- all source material is in-repo and verified
- Pitfalls: HIGH -- GitHub Markdown rendering behavior is well-documented
- Command reference: HIGH -- every entry verified against SKILL.md files
- Diagram rendering: MEDIUM -- Unicode box-drawing works but visual quality depends on font/browser

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- Markdown rendering and RAPID state won't change until Phase 37+)
