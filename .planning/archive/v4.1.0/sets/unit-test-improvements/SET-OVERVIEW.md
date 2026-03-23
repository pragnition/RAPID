# SET-OVERVIEW: unit-test-improvements

## Approach

This set addresses two related limitations in the unit-test skill: the hardcoded 5-concern-group cap and the hardcoded `node --test` runner. Both constraints prevent RAPID from scaling to larger projects and non-Node.js codebases.

The implementation strategy is to first make the test runner framework-agnostic by adding detection logic to the init pipeline and a config surface in `.planning/config.json`, then remove the group cap from the unit-test skill and replace it with a batched dispatch model. Batching preserves token-budget safety -- instead of spawning all groups simultaneously (which could exhaust context), groups are dispatched in batches with an approval gate between each batch. The auto-detection runs during init's research phase, inspecting project manifests (package.json, Cargo.toml, pyproject.toml, go.mod) to populate `testFramework` and `testRunner` fields in config.

Backward compatibility is critical: existing Node.js projects must behave identically after these changes. The detection defaults to `node --test` for Node.js projects, so the change is invisible unless a non-Node project is initialized.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `skills/unit-test/SKILL.md` | Unit test skill definition (dispatch logic, runner commands) | Existing -- modify |
| `src/lib/context.cjs` | Codebase detection utilities (add test framework detection) | Existing -- modify |
| `skills/init/SKILL.md` | Init skill (add test framework research step) | Existing -- modify |
| `.planning/config.json` | Project config (add testFramework, testRunner fields) | Existing -- modify |

## Integration Points

- **Exports:**
  - `unlimited-concern-groups`: Concern groups dispatched without artificial cap, using batched execution with approval gate
  - `framework-agnostic-runner`: Test runner auto-detected from project config (node --test, cargo test, pytest, go test)
  - `test-framework-config`: New `testFramework` and `testRunner` fields in `.planning/config.json`

- **Imports:** None -- this set is self-contained with no dependencies on other sets.

- **Side Effects:**
  - Init produces additional config fields (`testFramework`, `testRunner`) that persist across the project lifecycle
  - Unit test agent dispatch count is no longer bounded to 5 -- resource usage scales with concern group count

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Batched dispatch UX friction -- too many approval prompts for large sets | Medium | Size batches appropriately (e.g., 5 groups per batch) so users approve infrequently |
| Detection heuristic misidentifies test framework | Medium | Default to `node --test` for ambiguous cases; allow manual `testFramework` override in config |
| Token budget exhaustion with many concurrent agents | High | Batching is the primary mitigation; each batch waits for completion before spawning the next |
| Backward compatibility regression for existing Node.js projects | High | Explicit behavioral invariant; detection defaults to `node --test` for Node.js; add tests verifying this path |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- Add test framework detection to `src/lib/context.cjs` (detect from Cargo.toml, pyproject.toml, go.mod, package.json); define `testFramework`/`testRunner` config schema in config.json
- **Wave 2:** Init integration -- Wire detection into `skills/init/SKILL.md` research phase so config fields are populated on project init
- **Wave 3:** Unit-test skill changes -- Remove the 5-group cap from `skills/unit-test/SKILL.md`, implement batched dispatch with approval gate, replace hardcoded `node --test` with configured runner command

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
