# Phase 14: Install Skill Polish - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the install skill (SKILL.md) to detect the user's shell, present config file selection via AskUserQuestion, auto-source after writing, and provide clear fallback guidance when auto-sourcing fails. Strip setup.sh down to non-interactive bootstrap.

</domain>

<decisions>
## Implementation Decisions

### SKILL.md vs setup.sh responsibility split
- SKILL.md owns all user-facing interaction: shell detection, config file selection (AskUserQuestion), writing export lines, sourcing, verification, and fallback guidance
- setup.sh becomes non-interactive: prereqs check, npm install, validate rapid-tools, register plugin only — remove the interactive shell menu
- SKILL.md calls setup.sh for the non-interactive bootstrap steps, then handles shell config itself
- Consistent with v1.1 pattern where all skills use AskUserQuestion for decision gates

### Shell detection and presentation
- Read $SHELL and display detected shell info upfront: "Detected shell: fish (/bin/fish)"
- Then AskUserQuestion with config file options where detected shell's config is recommended
- Include "Skip — use .env only" as an option for users who don't want shell config modified
- Shell-aware config file mapping: bash → ~/.bashrc or ~/.bash_profile, zsh → ~/.zshrc, fish → ~/.config/fish/config.fish

### Auto-source strategy
- Shell-aware sourcing: detect if chosen config is fish and use `fish -c 'source ...; echo $RAPID_TOOLS'`, otherwise `bash -c 'source ... && echo $RAPID_TOOLS'` (or zsh equivalent)
- Source + verify in one Bash tool call (each Bash call is a fresh shell, so source must happen in same call as check)
- Verification = run `node $RAPID_TOOLS prereqs` after sourcing to prove full tool chain works (not just echo the path)
- If sourcing succeeds but prereqs fails: AskUserQuestion with Retry prereqs / Show manual fix steps / Cancel (v1.1 error recovery pattern)

### Fallback guidance
- When auto-sourcing fails: show exact `source ~/.zshrc` (or shell-equivalent) command in a copy-paste code block — minimal text
- After the source command, mention: "Note: .env fallback is already configured — RAPID will work in Claude Code regardless. The shell config is for terminal usage."
- If user chose "Skip shell config" earlier: no fallback guidance needed, just confirm .env is written and working

### Post-install UX
- After successful install: AskUserQuestion with "Run /rapid:help" / "Run /rapid:init" / "Done" — consistent with v1.1 next-action routing pattern

### Claude's Discretion
- Exact source command construction per shell type
- Error message wording for prereqs failures
- How to handle edge cases (missing config files, fish config dir doesn't exist)
- setup.sh refactoring approach (what to remove vs keep)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/install/SKILL.md`: Current install skill — delegates to setup.sh, needs rewrite to own shell detection
- `setup.sh`: Full bootstrap script with interactive shell menu — needs stripping down to non-interactive
- `src/bin/rapid-tools.cjs prereqs`: Prerequisite validation command — used as verification step

### Established Patterns
- All v1.1 skills use AskUserQuestion for decision gates (Phases 10-13)
- .env fallback loading pattern established in Phase 09.2 and quick task #7
- Error recovery uses AskUserQuestion with retry/skip/cancel options (Phase 13 pattern)
- Shell detection via `$SHELL` env var with bash/zsh/fish support (setup.sh already does this)

### Integration Points
- `skills/install/SKILL.md`: Primary file to rewrite
- `setup.sh`: Strip interactive menu, keep non-interactive bootstrap
- `.env` file at plugin root: Always written regardless of shell config choice

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-install-skill-polish*
*Context gathered: 2026-03-06*
