# PLAN: readme-migration / Wave 1

## Objective

Full rewrite of `README.md` with branded layout: centered banner header stack consuming `branding/banner-github.svg`, shields.io badge row with Everforest colors, one-line tagline, condensed "Problem" intro, `> [!TIP]` install callout, preserved quickstart, medium-depth "How It Works", collapsible `<details>` architecture section with lifecycle-flow and agent-dispatch SVGs, 7-command reference table, and arrow-prefix doc links. The new README replaces the existing 237-line file entirely.

Write the new README with `pragnition/RAPID` and `v5.0.0` from the start -- the version bump and reference migration happen in Wave 2 for other files, but since README.md is being fully rewritten, embed the correct values now to avoid double-editing.

## Owned Files

| File | Action |
|------|--------|
| `README.md` | Full rewrite |

## Task 1: Write the new README.md

Replace the entire contents of `README.md` with the structure defined below. Follow each section specification exactly.

### Section 1: Centered Banner

```html
<p align="center">
  <img src="branding/banner-github.svg" alt="RAPID" width="800" />
</p>
```

Use `width="800"` for optimal display. Relative path is correct for GitHub rendering.

### Section 2: Centered Badge Row

Immediately below the banner, centered. All four `<img>` tags on the same line inside a single `<p align="center">` block so they render inline.

Four badges using shields.io static badge format with flat-square style and Everforest colors:

1. **Version**: `https://img.shields.io/badge/version-5.0.0-d3c6aa?style=flat-square&labelColor=2d353b`
2. **License**: `https://img.shields.io/badge/license-MIT-a7c080?style=flat-square&labelColor=2d353b`
3. **Claude Code**: `https://img.shields.io/badge/Claude_Code-plugin-a7c080?style=flat-square&labelColor=2d353b`
4. **Node.js**: `https://img.shields.io/badge/Node.js-18%2B-a7c080?style=flat-square&labelColor=2d353b`

Separate each `<img>` with a single space (not a newline). Hex values omit `#` prefix. Use `labelColor=2d353b` for the dark Everforest label background.

### Section 3: Centered Tagline

```html
<p align="center">
  <em>Rapid Agentic Parallelizable and Isolatable Development</em>
</p>
```

One line, italic, centered. This is the recursive acronym expansion.

### Section 4: Intro / Problem

A condensed paragraph (3-5 sentences) explaining what RAPID does and why it exists. Cover:
- Claude Code is powerful solo but breaks with parallel developers
- Agents overwrite each other's work without isolation and ownership
- RAPID provides isolation (worktrees), ownership (file boundaries), contracts (interface specs), and structured merge

Do NOT use a section heading like "## The Problem". Just write the paragraph directly after the tagline, separated by a `---` horizontal rule. This keeps the top of the README clean and banner-focused.

End the paragraph with a brief statement that RAPID solves this with 27 specialized agents.

### Section 5: Install with TIP Callout

```markdown
## Install

> [!TIP]
> ```
> claude plugin add pragnition/RAPID
> ```

Then run `/rapid:install` inside Claude Code to configure your environment.
```

The `> [!TIP]` callout wraps the install command for visual emphasis. Every line inside the callout must be prefixed with `> `. The code fence inside the blockquote requires `> ` before each triple-backtick line too.

### Section 6: 60-Second Quickstart

Preserve the existing quickstart section **exactly as-is** from the current README (lines 27-42). Same heading, same code block, same explanatory sentence at the end. Do not modify any of the commands or their comments.

### Section 7: How It Works

Keep the existing "How It Works" content at medium depth. Preserve these subsections:
- Opening paragraph about sets
- Research pipeline paragraph
- Interface contracts paragraph
- Planning with validation paragraph
- Execution with per-wave agents paragraph
- 4-stage review pipeline (with the 4 bullet points)
- Multi-level merge paragraph

This section is already well-written and concise. Reproduce it from the current README (lines 44-63) without modification.

### Section 8: Collapsible Architecture

Use a `<details>` block (closed by default) containing both SVG diagrams. Critical: blank lines before and after inner markdown content per the CONTRACT.json behavioral constraint `details-blank-lines`.

Structure:

```html
<details>
<summary>Architecture</summary>

<p align="center">
  <img src="branding/lifecycle-flow.svg" alt="RAPID Lifecycle Flow" width="800" />
</p>

The 7-phase lifecycle: init, start-set, discuss, plan, execute, review, and merge. Each phase produces artifacts that feed the next.

<p align="center">
  <img src="branding/agent-dispatch.svg" alt="Agent Dispatch Architecture" width="800" />
</p>

27 agents organized by command. Each skill dispatches exactly the agents it needs -- no central coordinator.

</details>
```

Each SVG gets `width="800"` for consistency with the banner. Each SVG gets a 1-2 sentence caption below it explaining what it shows. Blank lines are mandatory before content after `</summary>` and before `</details>`.

### Section 9: Command Reference (7 Core Only)

Single table with the 7 core lifecycle commands. Same format as the current "7 Core Lifecycle Commands" table in the existing README (lines 127-136).

```markdown
## Command Reference

| Command | Description |
|---------|-------------|
| `/rapid:init` | Research project, generate roadmap, decompose into sets |
| `/rapid:start-set` | Create isolated worktree, generate scoped CLAUDE.md |
| `/rapid:discuss-set` | Capture developer implementation vision before planning |
| `/rapid:plan-set` | Plan all waves in a set -- research, plan, validate |
| `/rapid:execute-set` | Execute all waves with per-wave executor agents |
| `/rapid:review` | Scope review targets and produce REVIEW-SCOPE.md |
| `/rapid:merge` | Merge completed sets to main with conflict detection |

See [DOCS.md](DOCS.md) for the full reference covering all 28 commands.
```

Do NOT include the review pipeline, auxiliary, or utilities tables. The link to DOCS.md below the table covers those.

### Section 10: Arrow-Prefix Doc Links

```markdown
## Links

-> [Full Documentation](DOCS.md) -- all 28 commands, architecture, state machines, configuration

-> [Contributing Guide](CONTRIBUTING.md) -- how to contribute to RAPID

-> [License](LICENSE) -- MIT
```

Use `->` as the arrow prefix. Each link on its own line with a brief description after `--`.

### Section 11: License

```markdown
## License

MIT -- see [LICENSE](LICENSE).
```

One-liner, same as the current README.

### What NOT to Do

- Do NOT include the Real-World Example walkthrough (removed per CONTEXT.md decision)
- Do NOT include the full 28-command reference tables (moved to DOCS.md)
- Do NOT include the Agent Dispatch text tree (moved to collapsible architecture SVG)
- Do NOT include the Mermaid diagram (replaced by lifecycle-flow SVG)
- Do NOT use absolute GitHub URLs for SVGs -- relative paths work for GitHub README rendering
- Do NOT put the badge `<img>` tags on separate lines -- they must be on the same line to render inline
- Do NOT forget blank lines in the `<details>` block -- GitHub will render markdown as raw text without them

## Verification

```bash
# 1. Check file exists and has reasonable length (target: 80-130 lines)
wc -l README.md

# 2. Verify banner SVG reference
grep -c "branding/banner-github.svg" README.md  # Expect: 1

# 3. Verify badge row (4 badges)
grep -c "img.shields.io/badge" README.md  # Expect: 4

# 4. Verify TIP callout
grep -c "\[!TIP\]" README.md  # Expect: 1

# 5. Verify collapsible architecture
grep -c "<details>" README.md  # Expect: 1
grep -c "</details>" README.md  # Expect: 1

# 6. Verify architecture SVGs
grep -c "lifecycle-flow.svg" README.md  # Expect: 1
grep -c "agent-dispatch.svg" README.md  # Expect: 1

# 7. Verify 7 core commands in table
grep -c "rapid:" README.md  # Expect: at least 7 (commands) + install reference

# 8. Verify arrow-prefix links
grep -c "^->" README.md  # Expect: 3

# 9. Verify DOCS.md link
grep -c "DOCS.md" README.md  # Expect: at least 2 (command reference + links section)

# 10. Verify uses pragnition (not fishjojo1)
grep -c "pragnition" README.md  # Expect: at least 1
grep -c "fishjojo1" README.md  # Expect: 0

# 11. Verify uses 5.0.0 (not 4.4.0)
grep -c "5.0.0" README.md  # Expect: at least 1 (badge)
grep -c "4.4.0" README.md  # Expect: 0

# 12. Verify <details> blank line rule: line after </summary> must be blank
grep -A1 "</summary>" README.md | grep -c "^$"  # Expect: 1
```

## Success Criteria

1. README.md is fully rewritten with all 11 sections present
2. Banner SVG renders at top, centered, width 800
3. Four shields.io badges in a centered row with Everforest colors
4. Install command wrapped in `> [!TIP]` callout
5. Architecture section is collapsible `<details>` with both SVGs and captions
6. Command reference shows only 7 core commands with DOCS.md link
7. Arrow-prefix links at bottom: DOCS.md, CONTRIBUTING.md, LICENSE
8. Zero `fishjojo1` references -- all org references use `pragnition`
9. Version `5.0.0` used (not `4.4.0`) in badge and any version mentions
10. Quickstart block preserved exactly from original
