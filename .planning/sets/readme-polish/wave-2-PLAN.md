# Wave 2 Plan: README Restructure

**Set:** readme-polish
**Wave:** 2
**Objective:** Rewrite README.md to be concise, scannable, and visually structured following OpenSpec-style conventions. Promote diagrams to primary visual anchors at full container width.

## Context

The current README is 105 lines / 787 words with a dense prose intro paragraph, a lengthy "How It Works" section (38 lines of bold-titled paragraphs), and a redundant License section. Per the CONTEXT.md decisions, this wave transforms the README using these specific changes:

1. Replace the italic tagline with a blockquote philosophy statement
2. Replace the 4-line prose intro with a bold one-liner + 3-4 bullet points
3. Promote both SVG diagrams out of the collapsed `<details>` block into the main flow as full-width images
4. Condense "How It Works" from ~38 lines to ~20-25 lines (keep bold-titled paragraph structure, shorten each to 1-2 sentences, compress review pipeline to 1-2 sentences mentioning adversarial bug-hunt)
5. Merge the License section into the Links section as an arrow-prefix line
6. Remove `width="800"` from all `<img>` tags so SVGs render at full container width

## Tasks

### Task 1: Rewrite README.md

**File:** `README.md`

**Actions:**

Replace the entire content of README.md with the restructured version. The new structure should follow this exact outline:

**Section 1: Header (banner + badges + philosophy)**
```
<p align="center">
  <img src="branding/banner-github.svg" alt="RAPID" />
</p>
```
- Remove `width="800"` from banner img tag (let it be responsive)
- Keep the badges line exactly as-is (no changes to badge URLs or styling)
- Replace the italic tagline `<em>Rapid Agentic Parallelizable and Isolatable Development</em>` with a blockquote philosophy statement:
```markdown
> Parallel AI development needs isolation, ownership, contracts, and structured merge.
> RAPID provides all four.
```
- Keep the `---` divider

**Section 2: Bullet-point intro (replacing dense prose paragraph)**
Replace the 4-line prose paragraph (line 15) with:
```markdown
**RAPID is a Claude Code plugin that coordinates parallel AI-assisted development.**

- **Isolation** -- each set gets its own git worktree; agents never touch each other's files
- **Ownership** -- file boundaries enforced per set; no overlapping modifications
- **Contracts** -- `CONTRACT.json` specs define what each set exports and imports
- **Merge strategy** -- 5-level conflict detection with tiered auto-resolution
```

**Section 3: Install (unchanged)**
Keep the Install section exactly as-is. No changes needed.

**Section 4: 60-Second Quickstart (unchanged)**
Keep exactly as-is. No changes needed.

**Section 5: Architecture diagrams (promoted from collapsed block)**
Add a new `## Architecture` section AFTER the Quickstart section and BEFORE "How It Works". Content:
```markdown
## Architecture

<p align="center">
  <img src="branding/lifecycle-flow.svg" alt="RAPID Lifecycle Flow" />
</p>

<p align="center">
  <img src="branding/agent-dispatch.svg" alt="Agent Dispatch Architecture" />
</p>
```
- No `width` attribute on either `<img>` tag -- diagrams render at full container width
- No caption text below diagrams (the diagrams are self-explanatory with their built-in titles)

**Section 6: How It Works (condensed)**
Rewrite the "How It Works" section. Keep the bold-titled paragraph structure but compress each to 1-2 sentences. Target ~20-25 lines total (down from 38).

Specific condensation targets:
- **Research pipeline** -- 1-2 sentences. Mention 6 parallel researchers + synthesizer + roadmapper.
- **Interface contracts** -- 1-2 sentences. Mention CONTRACT.json, machine-verifiable, validated at plan/execute/merge.
- **Planning** -- 1-2 sentences. Mention researcher + planner + verifier pipeline.
- **Execution** -- 1-2 sentences. Mention one executor per wave, atomic commits, resume on interrupt.
- **Review pipeline** -- Condense the 4-stage breakdown (currently 7 lines with bullet list) into 1-2 sentences. Must mention: scoping, unit tests, adversarial bug-hunt (hunter/devil's-advocate/judge), and acceptance testing.
- **Merge** -- 1-2 sentences. Mention 5-level conflict detection, confidence cascade, fast-path for clean merges.

Remove the `<details><summary>Architecture</summary>...</details>` block entirely (diagrams now live in their own section above).

**Section 7: Command Reference (unchanged)**
Keep the table and DOCS.md link exactly as-is.

**Section 8: Links (absorb License)**
Merge License into the Links section. The new Links section should have 4 arrow-prefix lines:
```markdown
## Links

-> [Full Documentation](DOCS.md) -- all 28 commands, architecture, state machines, configuration

-> [Contributing Guide](CONTRIBUTING.md) -- how to contribute to RAPID

-> [License](LICENSE) -- MIT
```
Wait -- this is actually the same as current but without the separate License section below it. So just remove the `## License` section and its content (lines 103-105). The existing Links section already has the license link.

**What NOT to do:**
- Do not change badge URLs, colors, or ordering
- Do not modify the Install or Quickstart sections
- Do not modify the Command Reference table content
- Do not add any new commands to the table
- Do not add collapsible/details blocks (diagrams are promoted, not hidden)
- Do not add emojis anywhere
- Do not change DOCS.md, CONTRIBUTING.md, or LICENSE references

**Verification:**
```bash
# Check README has no width="800" attributes
grep -c 'width="800"' README.md
# Should output "0"

# Check diagrams are present as full-width images
grep -c 'lifecycle-flow.svg' README.md
# Should output "1"
grep -c 'agent-dispatch.svg' README.md
# Should output "1"

# Check no <details> blocks remain
grep -c '<details>' README.md
# Should output "0"

# Check License section is removed (no ## License heading)
grep -c '^## License' README.md
# Should output "0"

# Check blockquote philosophy is present
grep -c '^>' README.md
# Should output "2" (two lines of blockquote)

# Line count check -- target is ~80-95 lines (down from 105)
wc -l README.md
```

## Success Criteria

1. README.md has no `width="800"` on any `<img>` tag
2. Dense prose intro paragraph replaced with bold one-liner + 4 bullet points
3. Italic tagline replaced with blockquote philosophy statement
4. Both SVG diagrams promoted into a standalone `## Architecture` section (not inside `<details>`)
5. "How It Works" section condensed to ~20-25 lines with 1-2 sentences per subsection
6. Review pipeline condensed to 1-2 sentences mentioning adversarial bug-hunt (hunter/devil's-advocate/judge)
7. Separate `## License` section removed; license already linked in Links section
8. Install, Quickstart, and Command Reference sections unchanged
9. Total line count between 80-95 lines
10. All internal links still valid (DOCS.md, CONTRIBUTING.md, LICENSE)

## File Ownership

| File | Action |
|------|--------|
| `README.md` | Rewrite (full restructure) |
