# SET-OVERVIEW: path-resolution-fix

## Approach

The `RAPID_TOOLS` environment variable points to a `.cjs` file (`src/bin/rapid-tools.cjs`), not a directory. Several skill files use `require('${RAPID_TOOLS}/../lib/...')` to load sibling modules, which fails because Node's `path.resolve` treats the `.cjs` filename as a path component -- `../` navigates from the file itself rather than its parent directory. The result is a broken path that skips one level too few.

The fix is straightforward: replace all `${RAPID_TOOLS}/../lib/` patterns with `path.join(path.dirname('${RAPID_TOOLS}'), '..', 'lib', ...)` or the equivalent `require(path.resolve(path.dirname(process.env.RAPID_TOOLS), '..', 'lib', 'module.cjs'))`. This ensures resolution always starts from the directory containing `rapid-tools.cjs`, which is `src/bin/`, making `../lib/` correctly resolve to `src/lib/`.

Since both affected files are SKILL.md files containing embedded JavaScript code blocks, the edits are inline string replacements within Markdown fenced code sections. No structural changes are needed.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `skills/init/SKILL.md` | Init skill -- 2 require() calls to fix | Existing |
| `skills/register-web/SKILL.md` | Register-web skill -- 2 require() calls to fix | Existing |
| `src/bin/rapid-tools.cjs` | The file RAPID_TOOLS points to (reference only) | Existing (unchanged) |
| `src/lib/context.cjs` | Target module imported by init skill | Existing (unchanged) |
| `src/lib/web-client.cjs` | Target module imported by both skills | Existing (unchanged) |

## Integration Points

- **Exports:** None -- this set is a bugfix with no new public API.
- **Imports:** None -- no cross-set dependencies.
- **Side Effects:** After this fix, `/rapid:init` and `/rapid:register-web` will correctly resolve and load `context.cjs` and `web-client.cjs` at runtime. Any other skills that copy this pattern should adopt `path.dirname()` as well.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Embedded JS in SKILL.md has unusual quoting (template literals inside Markdown) | Medium | Carefully inspect surrounding context before editing; test with actual skill invocation |
| Other files may have the same broken pattern | Low | Grep the entire repo for `RAPID_TOOLS}/../` to find any additional occurrences beyond the two owned files |
| path module may not be available in the inline code context | Low | Verify that `const path = require('path')` is already present or add it |

## Wave Breakdown (Preliminary)

- **Wave 1:** Fix all 4 `require()` calls across both SKILL.md files. Grep for any additional occurrences of the broken pattern in the broader codebase and flag them. Verify `path` module availability in each code block.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
