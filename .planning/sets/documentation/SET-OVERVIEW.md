# SET-OVERVIEW: documentation

## Approach

This set prepares RAPID for open-sourcing by creating comprehensive, human-readable documentation. The core challenge is that the existing README.md references v3.0 and DOCS.md references v3.5.0, while the project is now at v4.4.0 with 28 skills -- many of which were added in later milestones and lack proper user-facing documentation.

The strategy is to work outward from the entry points: first rewrite README.md as the open-source front door (quickstart, feature overview, installation), then rewrite DOCS.md to cover the full canonical workflow from `/install` through `/merge` and beyond, and finally update or create individual docs/ reference files for all commands. A cross-reference audit against the skills/ directory ensures 100% coverage with no stale references.

This set has zero imports from other sets and zero file overlap with `colouring` or `review-state`, making it fully independent. The work is documentation-only -- no code changes.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| README.md | Open-source front door: quickstart, features, installation | Existing (rewrite) |
| DOCS.md | Comprehensive workflow documentation for all commands | Existing (rewrite) |
| docs/setup.md | Installation and setup guide | Existing (update) |
| docs/planning.md | Planning phase documentation (init, discuss, plan) | Existing (update) |
| docs/execution.md | Execution phase documentation | Existing (update) |
| docs/review.md | Review pipeline documentation | Existing (update) |
| docs/merge-and-cleanup.md | Merge and cleanup documentation | Existing (update) |
| docs/agents.md | Agent roles and architecture | Existing (update) |
| docs/state-machines.md | State machine reference | Existing (update) |
| docs/troubleshooting.md | Troubleshooting guide | Existing (update) |
| docs/configuration.md | Configuration reference | Existing (update) |
| docs/CHANGELOG.md | Version changelog | Existing (update) |

## Integration Points

- **Exports:** README.md (open-source front door), DOCS.md (full workflow reference), docs/* (individual reference files)
- **Imports:** None -- this set is fully self-contained with no dependencies on other sets
- **Side Effects:** None -- documentation-only changes with no behavioral impact on the codebase

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stale references to removed or renamed commands | Medium | Cross-reference audit against skills/ directory as final task |
| Missing coverage for newer skills (bug-hunt, uat, register-web, migrate, pause, resume, etc.) | High | Enumerate all 28 skills from skills/ directory and verify each has documentation |
| Documentation drifts from actual CLI behavior | Medium | Reference SKILL.md files as source of truth for command descriptions |
| README scope creep making it too long | Low | Keep README focused on quickstart; defer details to DOCS.md and docs/ |

## Wave Breakdown (Preliminary)

- **Wave 1:** README.md rewrite (open-source front door with quickstart, features, installation, architecture overview)
- **Wave 2:** DOCS.md rewrite (canonical workflow from /install through /merge, covering all 28 skills in logical order) and docs/ file updates
- **Wave 3:** Cross-reference audit (verify every skill in skills/ has corresponding documentation, fix any gaps or stale references)

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
