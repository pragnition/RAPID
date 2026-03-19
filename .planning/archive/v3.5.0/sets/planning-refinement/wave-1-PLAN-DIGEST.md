# DIGEST: planning-refinement -- Wave 1

## Tasks (4)

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `skills/discuss-set/SKILL.md` | Modify | Add UI/UX conditional guidance paragraph to Step 5 between criteria list and AskUserQuestion block |
| 2 | `skills/unit-test/SKILL.md` | Modify | Replace Step 1 with auto-detection fallback (standard path first, then post-merge path) |
| 3 | `skills/bug-hunt/SKILL.md` | Modify | Replace Step 1 with auto-detection fallback (same pattern as Task 2) |
| 4 | `skills/uat/SKILL.md` | Modify | Replace Step 1 with auto-detection fallback (same pattern as Task 2) |

## Key Constraints
- discuss-set: 4 gray area count unchanged, no dedicated UI/UX slot
- Review skills: `--post-merge` flag retained as explicit override, standard path takes precedence in auto-detect
- All changes are prompt text only -- no library or CLI code modifications

## Verification
- `node --test skills/discuss-set/SKILL.test.cjs` -- all 9 tests pass
- Each review skill contains "Auto-detect by checking paths in order" in Step 1
- Each review skill retains `--post-merge` in Step 0b
