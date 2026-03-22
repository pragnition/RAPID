# SET-OVERVIEW: review-cli-fix

## Approach

The `review log-issue` subcommand currently only accepts issue data via stdin JSON. This forces callers (including review agents) to construct and pipe JSON objects, which is error-prone and verbose for simple issue logging. The fix adds a CLI flag interface (`--type`, `--severity`, `--title`, `--description`) as an alternative input method, while keeping the existing stdin JSON path fully backward-compatible.

The implementation strategy is straightforward: detect whether stdin has data. If it does, use the existing JSON parse path. If not, fall back to parsing CLI flags via the existing `parseArgs` utility. When using CLI flags, `id` and `createdAt` fields are auto-generated (UUID and ISO timestamp) since the caller should not need to provide those for simple issue logging. After parsing, both paths produce the same issue object and flow into the existing `review.logIssue()` / `review.logIssuePostMerge()` calls.

Documentation across skill files must be updated to show both usage patterns so that agents and human users know both interfaces are available.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/commands/review.cjs | `log-issue` subcommand handler (lines 66-92) | Existing -- modify |
| src/lib/args.cjs | `parseArgs` utility for CLI flag parsing | Existing -- use as-is |
| src/lib/stdin.cjs | `readStdinSync` utility for stdin detection | Existing -- use as-is |
| skills/unit-test/SKILL.md | Skill doc referencing log-issue | Existing -- modify docs section |
| skills/review/SKILL.md | Skill doc referencing log-issue (if exists) | Existing -- modify docs section |
| skills/uat/SKILL.md | Skill doc referencing log-issue | Existing -- modify docs section |
| skills/bug-hunt/SKILL.md | Skill doc referencing log-issue | Existing -- modify docs section |

## Integration Points

- **Exports:** Dual-interface `review log-issue` command -- both `echo '{"..."}' | review log-issue <set-id>` and `review log-issue <set-id> --type <t> --severity <s> --title <t> --description <d>` produce identical logged issues.
- **Imports:** None -- this set has no dependencies on other sets.
- **Side Effects:** Issue JSON files written to `.planning/sets/<setId>/ISSUES.json` (unchanged from current behavior).

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| stdin detection false positive (empty stdin misread as "no stdin") | Medium | Use `readStdinSync()` return value; treat empty/whitespace as "no stdin" and fall back to flags |
| Breaking existing callers that pipe JSON | High | Keep stdin JSON as the primary path; only use flags when stdin is empty. Add backward-compat tests. |
| Flag name collision with existing `--post-merge` flag | Low | Use `parseArgs` schema to explicitly declare new flags alongside existing ones |
| Skill docs out of sync with actual CLI | Medium | Update all skill files that reference `log-issue` in the same wave as the code change |

## Wave Breakdown (Preliminary)

- **Wave 1:** Core implementation -- modify `log-issue` handler in `review.cjs` to support CLI flags via `parseArgs`, auto-generate `id`/`createdAt`, add unit tests for both interfaces and backward compatibility.
- **Wave 2:** Documentation -- update `log-issue` usage strings and all skill docs (unit-test, review, uat, bug-hunt) to reflect both input methods.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
