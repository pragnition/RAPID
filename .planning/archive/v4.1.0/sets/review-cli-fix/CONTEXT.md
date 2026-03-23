# CONTEXT: review-cli-fix

**Set:** review-cli-fix
**Generated:** 2026-03-22
**Mode:** interactive

<domain>
## Set Boundary
Adds a CLI flag interface (`--type`, `--severity`, `--title`, `--description`) to the `review log-issue` subcommand as an alternative to piping JSON via stdin. Keeps the existing stdin JSON path fully backward-compatible. Updates skill docs across unit-test, uat, and bug-hunt to reflect both input methods.
</domain>

<decisions>
## Implementation Decisions

### Stdin Detection Strategy

- Use try/catch around `readStdinSync()` — if it throws "No data on stdin", fall back to parsing CLI flags. No new dependencies or platform-specific checks.

### Required vs Optional Flags

- All four flags are required in CLI flag mode: `--type`, `--severity`, `--title`, `--description`. Missing any throws a CliError with a usage hint showing full syntax.
- Add `--wave` flag to support `originatingWave` field, matching the positional wave-id that stdin mode supports.

### ID Generation Format

- Use `crypto.randomUUID()` (Node.js built-in) for auto-generating the issue `id` field in CLI flag mode. Standard UUID v4 format.
- `createdAt` auto-generated as ISO timestamp via `new Date().toISOString()`.

### Doc Update Scope

- Add a CLI flags usage example alongside the existing stdin JSON example in each skill's log-issue section (unit-test, uat, bug-hunt). Minimal and focused — no full rewrites.

### Claude's Discretion

- None — all areas discussed with user.
</decisions>

<specifics>
## Specific Ideas
- The CLI flag interface exists to reduce JSON construction/escaping errors in agent prompts — agents can call flags directly instead of constructing JSON strings.
- Error reporting uses CliError with usage hints, consistent with existing CLI error patterns throughout review.cjs.
</specifics>

<code_context>
## Existing Code Insights

- `readStdinSync()` in `src/lib/stdin.cjs` throws `CliError('No data on stdin')` when stdin is empty — this is the catch target for fallback detection.
- `parseArgs()` from `src/lib/args.cjs` is already used elsewhere in review.cjs (e.g., `list-issues` at line 95) — reuse it for flag parsing.
- The `log-issue` handler (lines 66-92 of `review.cjs`) already supports `--post-merge` flag and positional `wave-id` — new flags must coexist with these.
- `review.logIssue()` and `review.logIssuePostMerge()` accept an issue object — both paths (stdin JSON and CLI flags) must produce the same object shape.
- Skill docs referencing log-issue: `skills/unit-test/SKILL.md`, `skills/uat/SKILL.md`, `skills/bug-hunt/SKILL.md`.
</code_context>

<deferred>
## Deferred Ideas
- None identified during discussion.
</deferred>
