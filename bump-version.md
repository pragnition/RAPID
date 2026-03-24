# How to Bump RAPID Versions

When releasing a new version of RAPID, update the following files:

## Required Files

| File | Field / Location | Example |
|------|-----------------|---------|
| `package.json` | `"version"` | `"4.3.0"` |
| `.claude-plugin/plugin.json` | `"version"` | `"4.3.0"` |
| `.planning/config.json` | `"project.version"` | `"4.3.0"` |
| `.planning/STATE.json` | `"rapidVersion"` | `"4.3.0"` |
| `docs/CHANGELOG.md` | Add new `## [vX.Y.Z] (in progress)` header, update previous version header with ship date |
| `skills/help/SKILL.md` | All `vX.Y.Z` references (replace_all) |
| `skills/install/SKILL.md` | All `vX.Y.Z` references including description frontmatter (replace_all) |
| `skills/status/SKILL.md` | All `vX.Y.Z` references (replace_all) |

## Do NOT Update

- **Archive files** (`.planning/archive/`) — these are historical records of past milestones
- **Research files** (`.planning/research/v*.md`) — historical research tied to specific versions
- **package-lock.json** — dependency versions (e.g., tailwindcss 4.2.2) are unrelated to RAPID version
- **STATE.json milestone entries** — past milestone IDs like `"id": "v4.2.1"` are historical and should remain unchanged
- **ROADMAP.md** — past milestone entries are historical

## Quick Command

To find all current version references (replace `4.3.0` with current version):

```bash
grep -rn "4\.3\.0" --include="*.json" --include="*.md" --include="*.cjs" --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.rapid-worktrees --exclude-dir=.archive --exclude-dir=archive .
```

## Steps

1. Decide the new version number (semver: major.minor.patch)
2. Update all files listed in the table above
3. For skill files, use a global find-and-replace of the old version string with the new one
4. Verify with the grep command above that no stale references remain (excluding archives and historical files)
5. Commit the version bump
