# SET-OVERVIEW: docs-update

## Approach

This set brings DOCS.md and technical_documentation.md up to date with the current state of the project (v5.0). DOCS.md was rewritten as a central reference hub during v4.4.0 and received a version bump to 5.0.0 during the readme-migration set, but it has not been substantively updated to cover features, commands, and architectural changes introduced in v4.x through v5.0. technical_documentation.md is in much worse shape -- it was last rewritten for v3.0 and still references 26 agents, v3.0 nomenclature, and is missing everything from v3.4 onward (new commands, state machine changes, merge system, review pipeline evolution, solo mode, branding, and the plugin marketplace).

The strategy is to sweep through the git history from the last substantive documentation update for each file, identify all feature additions, command changes, agent additions/removals, configuration changes, and architectural shifts, then incorporate those updates into the two files. DOCS.md needs incremental updates (it is already v5-shaped), while technical_documentation.md needs a more significant rewrite to bring it from v3.0 to v5.0.

Since both files are standalone documentation with no code dependencies, the work is low-risk and can proceed independently of all other v5.0 sets. The primary challenge is completeness -- ensuring no significant change is missed during the version sweep.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| DOCS.md | Central reference hub -- commands, workflows, configuration | Existing (v5.0.0 header, ~v4.4 content) |
| technical_documentation.md | Deep technical reference -- agents, state machine, architecture | Existing (v3.0 content, severely outdated) |

## Integration Points

- **Exports:** None -- this set produces documentation only, no code artifacts
- **Imports:** None -- no runtime dependencies on other sets
- **Side Effects:** None -- documentation files are not consumed by any build or runtime process

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing changes during version sweep | Medium | Use structured git log queries per version range; cross-reference CHANGELOG and milestone archives |
| Merge conflicts with readme-polish or readme-migration | Low | These sets target README.md, not DOCS.md or technical_documentation.md; no overlap expected |
| technical_documentation.md rewrite introduces inaccuracies | Medium | Verify agent counts, command signatures, and state transitions against current source code (build-agents output, rapid-tools.cjs) |
| Documentation drifts from actual behavior | Low | Spot-check key claims (agent count, command list, state machine transitions) against src/ and skill definitions |

## Wave Breakdown (Preliminary)

- **Wave 1:** Version sweep and gap analysis -- audit git history from v3.0 to v5.0, catalog all changes relevant to each documentation file, produce a structured change list
- **Wave 2:** Update DOCS.md -- incorporate missing v5.0 features, commands, and workflow changes into the existing hub structure
- **Wave 3:** Rewrite technical_documentation.md -- bring from v3.0 to v5.0 with updated agent reference, state machine, configuration, and architecture sections

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
