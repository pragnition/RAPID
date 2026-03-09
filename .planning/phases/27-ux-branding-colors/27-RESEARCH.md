# Phase 27: UX Branding & Colors - Research

**Researched:** 2026-03-09
**Domain:** Terminal UX -- ANSI color output, Claude Code agent frontmatter, CLI display utilities
**Confidence:** HIGH

## Summary

This phase adds two distinct visual features to RAPID: (1) branded stage banners displayed at each skill invocation using raw ANSI escape codes, and (2) color-coded agent type indicators using Claude Code's native `color` frontmatter field. The implementation splits cleanly: banners are a new `src/lib/display.cjs` module exposed via a `rapid-tools display banner` CLI subcommand, while agent colors are a one-line addition to the existing `generateFrontmatter()` function in `assembler.cjs`.

The `color` field in Claude Code agent YAML frontmatter is confirmed functional but underdocumented. It accepts values: `red`, `blue`, `green`, `purple`, `yellow`, `orange`, `cyan`, and `default`. Since RAPID's `assemble-agent` command writes assembled agents to `.claude/agents/{agentName}.md` files, the `color` field in frontmatter WILL be processed by Claude Code's agent loading system. No custom ANSI coloring is needed for agent type indicators.

**Primary recommendation:** Implement banner display as a standalone `display.cjs` module with raw ANSI escape codes (zero dependencies). Add `ROLE_COLORS` map to `assembler.cjs` parallel to existing `ROLE_TOOLS` and `ROLE_DESCRIPTIONS` maps. Add banner calls to the 7 stage-transition skills via `node "${RAPID_TOOLS}" display banner <stage> <target>`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Block banner style: full-width colored background block with white text
- Fixed width (~40-50 chars), not terminal-aware
- Block characters (block character) used for border -- no fallback to dashes/equals needed
- RAPID brand name in bold white, action verb (EXECUTING, PLANNING, etc.) carries the stage color
- Content: stage name + target only (no progress counts, no timestamps)
- Example: `block RAPID > EXECUTING  Wave 1.1 block` with colored background
- All 7 stage transitions get banners: init, set-init, discuss, wave-plan, execute, review, merge
- Top-level banners only -- one banner per skill invocation
- Sub-stages use lighter indicators (indented text, bullets), not banners
- Basic 16 ANSI color palette -- maximum terminal compatibility
- Colors grouped by function:
  - PLANNING roles (planner, wave-planner, job-planner) = blue
  - EXECUTION roles (executor, job-executor) = green
  - REVIEW roles (reviewer, judge) = red, bug-hunter = yellow, devils-advocate = magenta
- Stage banner backgrounds use the same color groups: planning stages = blue bg, execution stages = green bg, review stages = red bg
- Agent colors (UX-07): Use Claude Code's native `color` frontmatter field in assembler.cjs
- Stage banners (UX-06): New `src/lib/display.cjs` utility with banner rendering functions using raw ANSI escape codes (no third-party dependencies)
- Skills access banners via `rapid-tools display banner <stage> <target>` CLI subcommand
- Always output colors -- no auto-detection or NO_COLOR support
- Raw ANSI escape codes in display.cjs (no chalk, kleur, or other dependencies)

### Claude's Discretion
- Exact ANSI escape code sequences for each color
- Banner padding and internal spacing
- Which specific 16-color variants (bright vs normal) look best per role
- Sub-stage indicator formatting (indentation, bullets, etc.)
- Whether to map each of the 7 stages to planning/execution/review color groups or use a per-stage color

### Deferred Ideas (OUT OF SCOPE)
- Agent spawn namespace contamination (skills/agents spawning from `gsd-review:*` instead of `rapid:*`)
- Worktree-per-set enforcement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-06 | Stage banners display with RAPID branding and color coding in terminal output | New `display.cjs` module with `renderBanner()` function, exposed via `rapid-tools display banner` CLI subcommand. Raw ANSI escape codes for colored backgrounds. 7 skills need banner calls added at entry point. |
| UX-07 | Different agent types display with distinct colors (e.g. planner = blue, executor = green, reviewer = red) | Add `ROLE_COLORS` map to `assembler.cjs`, add `color` field to `generateFrontmatter()` output. Claude Code supports `color` field in agent frontmatter with values: red, blue, green, purple, yellow, orange, cyan, default. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in | 18+ | Runtime for all RAPID CLI tools | Already the project runtime |
| `node:test` | built-in | Unit test framework | Already used across all 20+ test files |
| `node:assert/strict` | built-in | Test assertions | Already used project-wide |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Raw ANSI escape codes | N/A | Terminal coloring | All banner output -- no library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw ANSI | chalk/kleur/picocolors | Would add a runtime dependency; RAPID has zero runtime deps by design (CONTEXT.md explicitly forbids this) |
| `color` frontmatter | Custom ANSI in agent output | Would require modifying every agent prompt; `color` field is native to Claude Code and free |

**Installation:**
No new packages required. Zero-dependency implementation.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── display.cjs          # NEW: Banner rendering + ANSI color utilities
│   ├── display.test.cjs     # NEW: Unit tests for display module
│   ├── assembler.cjs         # MODIFY: Add ROLE_COLORS map + color field in generateFrontmatter()
│   └── assembler.test.cjs    # MODIFY: Add tests for color field in frontmatter
├── bin/
│   └── rapid-tools.cjs       # MODIFY: Add 'display' command case
skills/
├── init/SKILL.md              # MODIFY: Add banner call at entry
├── set-init/SKILL.md          # MODIFY: Add banner call at entry
├── discuss/SKILL.md           # MODIFY: Add banner call at entry
├── wave-plan/SKILL.md         # MODIFY: Add banner call at entry
├── execute/SKILL.md           # MODIFY: Add banner call at entry
├── review/SKILL.md            # MODIFY: Add banner call at entry
└── merge/SKILL.md             # MODIFY: Add banner call at entry
```

### Pattern 1: ANSI Escape Code Constants
**What:** Define all ANSI codes as named constants in a single object
**When to use:** Throughout display.cjs for all color operations
**Example:**
```javascript
// Raw ANSI escape codes -- basic 16-color palette for maximum terminal compatibility
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  // Foreground colors
  white: '\x1b[37m',
  brightWhite: '\x1b[97m',
  // Background colors
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  // Bright background variants (more readable with white text)
  bgBrightBlue: '\x1b[104m',
  bgBrightGreen: '\x1b[102m',
  bgBrightRed: '\x1b[101m',
};
```

### Pattern 2: Stage-to-Color Group Mapping
**What:** Map each of the 7 banner stages to a color group
**When to use:** When rendering banners
**Example:**
```javascript
// Stage -> color group mapping (from CONTEXT.md decisions)
const STAGE_GROUPS = {
  init:      'planning',    // blue bg
  'set-init': 'planning',  // blue bg
  discuss:   'planning',    // blue bg
  'wave-plan': 'planning', // blue bg
  execute:   'execution',   // green bg
  review:    'review',      // red bg
  merge:     'review',      // red bg
};

const GROUP_COLORS = {
  planning:  { bg: '\x1b[44m',  verb: '\x1b[94m' },  // blue bg, bright blue verb
  execution: { bg: '\x1b[42m',  verb: '\x1b[92m' },  // green bg, bright green verb
  review:    { bg: '\x1b[41m',  verb: '\x1b[91m' },  // red bg, bright red verb
};
```

### Pattern 3: ROLE_COLORS Map (Parallel to ROLE_TOOLS)
**What:** Map each agent role to a Claude Code `color` frontmatter value
**When to use:** In `assembler.cjs` for `generateFrontmatter()`
**Example:**
```javascript
const ROLE_COLORS = {
  planner: 'blue',
  executor: 'green',
  reviewer: 'red',
  verifier: 'blue',
  orchestrator: 'blue',
  'wave-researcher': 'blue',
  'wave-planner': 'blue',
  'job-planner': 'blue',
  'job-executor': 'green',
  'unit-tester': 'cyan',
  'bug-hunter': 'yellow',
  'devils-advocate': 'purple',
  'judge': 'red',
  'bugfix': 'green',
  'uat': 'cyan',
  'merger': 'green',
};
```

### Pattern 4: Banner Rendering Function
**What:** Pure function that returns a formatted banner string
**When to use:** Called by the `display banner` CLI subcommand
**Example:**
```javascript
/**
 * Render a branded RAPID stage banner.
 *
 * @param {string} stage - Stage name (init, set-init, discuss, wave-plan, execute, review, merge)
 * @param {string} target - Target description (e.g., "Wave 1.1", "auth-system")
 * @returns {string} Formatted banner string with ANSI escape codes
 */
function renderBanner(stage, target) {
  const group = STAGE_GROUPS[stage];
  if (!group) return `[RAPID] Unknown stage: ${stage}`;

  const colors = GROUP_COLORS[group];
  const verb = STAGE_VERBS[stage]; // e.g., 'INITIALIZING', 'EXECUTING', etc.

  // Fixed width ~45 chars, padded
  const content = ` ▓▓▓ RAPID ► ${verb}  ${target} ▓▓▓ `;
  return `${colors.bg}${ANSI.bold}${ANSI.brightWhite}${content}${ANSI.reset}`;
}
```

### Pattern 5: CLI Subcommand Integration
**What:** Add `display` command to rapid-tools.cjs dispatcher
**When to use:** For the `rapid-tools display banner <stage> <target>` subcommand
**Example:**
```javascript
// In rapid-tools.cjs main switch:
case 'display':
  handleDisplay(subcommand, args.slice(2));
  break;

// Handler function:
function handleDisplay(subcommand, args) {
  const { renderBanner } = require('../lib/display.cjs');

  switch (subcommand) {
    case 'banner': {
      const stage = args[0];
      const target = args.slice(1).join(' ');
      if (!stage) {
        error('Usage: rapid-tools display banner <stage> [target]');
        process.exit(1);
      }
      // NOTE: Banner output goes to stdout as raw text, NOT JSON
      // This is intentional -- banners are visual output, not data
      process.stdout.write(renderBanner(stage, target) + '\n');
      break;
    }
    default:
      error(`Unknown display subcommand: ${subcommand}`);
      process.exit(1);
  }
}
```

### Pattern 6: Skill Banner Integration
**What:** Add banner call at the top of each stage-transition skill
**When to use:** In each of the 7 SKILL.md files, immediately after environment setup
**Example:**
```markdown
## Step 0.5: Display Stage Banner

Display the RAPID stage banner:

\`\`\`bash
node "${RAPID_TOOLS}" display banner execute "${SET_NAME}"
\`\`\`
```

### Anti-Patterns to Avoid
- **Importing a color library:** RAPID has zero runtime dependencies by design. Do not add chalk, kleur, picocolors, or ansi-colors.
- **Terminal width detection:** The context explicitly says fixed width, not terminal-aware. Do not use `process.stdout.columns`.
- **NO_COLOR / FORCE_COLOR env var checking:** The context explicitly says "always output colors -- no auto-detection or NO_COLOR support."
- **Putting banner logic in skills:** Banner rendering belongs in display.cjs, not inline in SKILL.md files. Skills call the CLI subcommand.
- **Using template literals with ANSI codes inline in skills:** Skill markdown cannot contain ANSI escape sequences. The CLI subcommand handles all ANSI output.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent type coloring | Custom ANSI in agent prompts | Claude Code `color` frontmatter field | Native to Claude Code, zero effort, persists across sessions |
| Color parsing/validation | Custom color name -> ANSI mapping | Simple object literal | Only 6 colors used, no dynamic mapping needed |

**Key insight:** The agent coloring (UX-07) is nearly free -- it is a single field addition to existing frontmatter generation. The real work is in the banner system (UX-06).

## Common Pitfalls

### Pitfall 1: Assuming `color` Frontmatter Works in Inline Agent Prompts
**What goes wrong:** Adding `color:` to the YAML frontmatter in assembled agent text and expecting Claude Code to render it when passed via the Agent tool.
**Why it happens:** RAPID's `assemble-agent` writes to `.claude/agents/{name}.md` files, so the `color` field IS processed by Claude Code's file-based agent loading. This is NOT a pitfall for RAPID since agents are file-based.
**How to avoid:** Verify that `assemble-agent` writes to `{rapidDir}/agents/` (confirmed -- see `handleAssembleAgent` in rapid-tools.cjs line 499-500). The frontmatter `color` field will be parsed by Claude Code.
**Warning signs:** If agents are spawned with inline prompts that don't reference the assembled file, the color won't apply.

### Pitfall 2: ANSI Code Interference with JSON Output
**What goes wrong:** Banner output corrupts JSON parsing when skills pipe rapid-tools output to JSON parsers.
**Why it happens:** The `display banner` subcommand outputs raw ANSI text, not JSON. If a skill accidentally captures this output and tries to parse it as JSON, it fails.
**How to avoid:** The `display banner` subcommand outputs directly to stdout. Skills should call it as a standalone command (not capture its output). All other rapid-tools subcommands continue to output JSON.
**Warning signs:** Skills that wrap ALL rapid-tools calls in `$(...)` capture syntax.

### Pitfall 3: Block Characters Not Rendering in All Terminals
**What goes wrong:** The block character (U+2593) may not render in very old or minimal terminal emulators.
**Why it happens:** Unicode support varies across terminals.
**How to avoid:** The CONTEXT.md explicitly says "no fallback to dashes/equals needed." The block characters will display correctly on all modern terminals (macOS Terminal, iTerm2, Windows Terminal, most Linux terminals). This is an acceptable tradeoff.
**Warning signs:** Mojibake (boxes or question marks) in output.

### Pitfall 4: Bright vs Normal Color Variants
**What goes wrong:** Normal colors (30-37 / 40-47) may be too dark on some terminal themes, making white text unreadable.
**Why it happens:** Basic ANSI colors are theme-dependent. A "blue" background on a dark theme might be near-black.
**How to avoid:** Use bright/high-intensity background variants (100-107) for banners. `\x1b[104m` (bright blue bg) is more readable than `\x1b[44m` (blue bg) with white text. Test with both dark and light terminal themes.
**Warning signs:** Banner text that is hard to read on dark terminals.

### Pitfall 5: Banner Width Inconsistency
**What goes wrong:** Different stage names and targets produce different banner widths, looking messy.
**Why it happens:** Stage verbs ("INITIALIZING" vs "EXECUTING") and target names vary in length.
**How to avoid:** Pad the banner content to a fixed width (e.g., 50 characters). Use `.padEnd()` to ensure consistent visual width.
**Warning signs:** Banners that jump around in width between stages.

## Code Examples

### ANSI Escape Code Reference (Basic 16-Color Palette)
```javascript
// Source: ECMA-48 / ISO 6429 standard ANSI escape codes
// These are universally supported by all modern terminal emulators

// Format: \x1b[<code>m
// Reset
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Foreground colors (30-37, bright: 90-97)
const FG = {
  black: '\x1b[30m',   red: '\x1b[31m',
  green: '\x1b[32m',   yellow: '\x1b[33m',
  blue: '\x1b[34m',    magenta: '\x1b[35m',
  cyan: '\x1b[36m',    white: '\x1b[37m',
  brightBlack: '\x1b[90m',  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',   brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',   brightWhite: '\x1b[97m',
};

// Background colors (40-47, bright: 100-107)
const BG = {
  black: '\x1b[40m',   red: '\x1b[41m',
  green: '\x1b[42m',   yellow: '\x1b[43m',
  blue: '\x1b[44m',    magenta: '\x1b[45m',
  cyan: '\x1b[46m',    white: '\x1b[47m',
  brightBlack: '\x1b[100m',  brightRed: '\x1b[101m',
  brightGreen: '\x1b[102m',  brightYellow: '\x1b[103m',
  brightBlue: '\x1b[104m',   brightMagenta: '\x1b[105m',
  brightCyan: '\x1b[106m',   brightWhite: '\x1b[107m',
};
```

### Claude Code `color` Frontmatter Values
```javascript
// Source: verified via community usage and Claude Code /agents UI
// The color field is underdocumented but functional in agent .md files
// Allowed values:
const VALID_CLAUDE_CODE_COLORS = [
  'red',      // Review agents (reviewer, judge)
  'blue',     // Planning agents (planner, wave-planner, job-planner)
  'green',    // Execution agents (executor, job-executor, merger, bugfix)
  'yellow',   // Bug-hunter agent
  'purple',   // Devils-advocate agent
  'orange',   // Available but not currently assigned
  'cyan',     // Unit-tester, UAT agents
  'default',  // System default (no color)
];
```

### Updated generateFrontmatter() with Color
```javascript
// In assembler.cjs:
function generateFrontmatter(role) {
  const tools = ROLE_TOOLS[role] || 'Read, Bash, Grep, Glob';
  const description = ROLE_DESCRIPTIONS[role] || `RAPID ${role} agent`;
  const color = ROLE_COLORS[role] || 'default';

  return `---
name: rapid-${role}
description: ${description}
tools: ${tools}
model: inherit
color: ${color}
---`;
}
```

### Complete display.cjs Module Skeleton
```javascript
'use strict';

// ANSI escape codes -- basic 16-color palette
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  brightWhite: '\x1b[97m',
};

const STAGE_VERBS = {
  init: 'INITIALIZING',
  'set-init': 'PREPARING',
  discuss: 'DISCUSSING',
  'wave-plan': 'PLANNING',
  execute: 'EXECUTING',
  review: 'REVIEWING',
  merge: 'MERGING',
};

const STAGE_BG = {
  init: '\x1b[104m',       // bright blue
  'set-init': '\x1b[104m', // bright blue
  discuss: '\x1b[104m',    // bright blue
  'wave-plan': '\x1b[104m',// bright blue
  execute: '\x1b[102m',    // bright green
  review: '\x1b[101m',     // bright red
  merge: '\x1b[101m',      // bright red
};

function renderBanner(stage, target) {
  const verb = STAGE_VERBS[stage];
  const bg = STAGE_BG[stage];
  if (!verb || !bg) return `[RAPID] Unknown stage: ${stage}`;

  const inner = ` \u2593\u2593\u2593 RAPID \u25B6 ${verb}  ${target || ''} \u2593\u2593\u2593 `;
  // Pad to consistent width
  const padded = inner.padEnd(50);
  return `${bg}${ANSI.bold}${ANSI.brightWhite}${padded}${ANSI.reset}`;
}

module.exports = { renderBanner, STAGE_VERBS, STAGE_BG };
```

### Skill Banner Call Pattern
```bash
# Add after environment setup in each of the 7 skills:
# (env preamble here)
node "${RAPID_TOOLS}" display banner init
# or with target:
node "${RAPID_TOOLS}" display banner execute "${SET_NAME}"
node "${RAPID_TOOLS}" display banner wave-plan "${WAVE_ID}"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plain `[RAPID]` prefix text | Colored banners + agent color badges | Phase 27 (this phase) | Visual distinction between stages and agent types |
| No agent type visual distinction | Claude Code native `color` frontmatter | Claude Code v2.0+ (2025) | Each agent role gets a colored badge in the Claude Code UI |

**Deprecated/outdated:**
- The `Task` tool has been renamed to `Agent` in Claude Code v2.1.63+. Both names still work as aliases.
- The `color` field is functional but not listed in the official frontmatter documentation table (as of March 2026). It works in practice.

## Open Questions

1. **Bright vs Normal Background Colors**
   - What we know: Both work. Bright variants (100-107) are more readable with white text on dark themes. Normal variants (40-47) are more subdued.
   - What's unclear: Which looks better in practice with RAPID's specific banner format.
   - Recommendation: Use bright variants (\x1b[10Xm) as the default. They provide better contrast. Claude's discretion per CONTEXT.md.

2. **Per-Stage vs Group Colors for Banners**
   - What we know: CONTEXT.md says "planning stages = blue bg, execution stages = green bg, review stages = red bg"
   - What's unclear: Whether all 4 planning stages should be identical blue, or whether init/set-init could be a slightly different shade.
   - Recommendation: Start with group colors (all planning = same blue). Simple and consistent. Claude's discretion per CONTEXT.md.

3. **`color` Field for Assembled Agents Without Config**
   - What we know: `handleAssembleAgent` requires `config.agents[agentName]` to exist. Some agents may be spawned via inline prompts, not via `assemble-agent`.
   - What's unclear: Whether ALL agent spawns go through the assembled file path.
   - Recommendation: Add `color` to `generateFrontmatter()` regardless -- it covers both file-based and inline use cases. File-based gets the native Claude Code color. Inline gets the field in the YAML even if Claude Code may ignore it (no harm).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | None -- tests are standalone .cjs files |
| Quick run command | `node --test src/lib/display.test.cjs` |
| Full suite command | `node --test src/lib/display.test.cjs src/lib/assembler.test.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-06-a | renderBanner returns valid ANSI string for each of 7 stages | unit | `node --test src/lib/display.test.cjs` | Wave 0 |
| UX-06-b | renderBanner returns fallback for unknown stage | unit | `node --test src/lib/display.test.cjs` | Wave 0 |
| UX-06-c | Banner output includes RAPID branding, verb, and target | unit | `node --test src/lib/display.test.cjs` | Wave 0 |
| UX-06-d | `rapid-tools display banner <stage> <target>` CLI works | unit | `node --test src/bin/rapid-tools.test.cjs` | Modify existing |
| UX-07-a | generateFrontmatter includes `color:` field for every role | unit | `node --test src/lib/assembler.test.cjs` | Modify existing |
| UX-07-b | ROLE_COLORS maps all roles to valid Claude Code color values | unit | `node --test src/lib/assembler.test.cjs` | Modify existing |
| UX-07-c | Planning roles get blue, execution roles get green, review roles get red | unit | `node --test src/lib/assembler.test.cjs` | Modify existing |

### Sampling Rate
- **Per task commit:** `node --test src/lib/display.test.cjs src/lib/assembler.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs src/bin/*.test.cjs`
- **Phase gate:** Full suite green before verify-work

### Wave 0 Gaps
- [ ] `src/lib/display.test.cjs` -- covers UX-06 (renderBanner unit tests)
- [ ] `src/lib/display.cjs` -- new module (needed for tests to have something to test)

*(Existing `assembler.test.cjs` covers UX-07 tests -- modify existing file)*

## Sources

### Primary (HIGH confidence)
- [Claude Code Subagent Docs](https://code.claude.com/docs/en/sub-agents) -- confirmed `color` NOT in official frontmatter table, BUT confirmed in interactive /agents creation flow ("Choose a color" step)
- [Claude Code Skills Docs](https://code.claude.com/docs/en/skills) -- confirmed skill frontmatter fields and invocation patterns
- RAPID source code inspection (`src/lib/assembler.cjs`, `src/bin/rapid-tools.cjs`) -- confirmed `generateFrontmatter()` structure, `handleAssembleAgent` writes to `.claude/agents/` path
- ECMA-48 / ISO 6429 ANSI escape code standard -- verified escape code sequences

### Secondary (MEDIUM confidence)
- [Claude Code Feature Request #5254](https://github.com/anthropics/claude-code/issues/5254) -- confirms `color` field exists in agent configuration files
- [Shipyard Subagents Guide](https://shipyard.build/blog/claude-code-subagents-guide/) -- shows `color: orange` example in frontmatter
- [Claude Code Frontmatter Parser](https://lobehub.com/skills/drewipson-claude-code-config-yaml-frontmatter-parser) -- lists allowed color values: purple, cyan, green, orange, blue, red
- [claude-sub-agent repo](https://github.com/zhsama/claude-sub-agent) -- example usage of color field

### Tertiary (LOW confidence)
- None -- all critical claims verified with at least secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all existing patterns
- Architecture: HIGH -- follows established rapid-tools CLI dispatch pattern, parallel map pattern from ROLE_TOOLS/ROLE_DESCRIPTIONS
- Pitfalls: HIGH -- based on direct source code inspection and ANSI standards
- Agent color field: MEDIUM -- functional but underdocumented; confirmed via multiple community sources and the /agents UI flow

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain -- ANSI codes don't change; Claude Code color field may get documented)
