# SET-OVERVIEW: init-enhancements

## Approach

This set adds two independent capabilities to the `/rapid:init` flow: (1) a `--spec` flag that lets users feed a pre-written spec file into the research pipeline, and (2) a meta-principles capture step that generates `.planning/PRINCIPLES.md` and injects a compact summary into worktree-scoped `CLAUDE.md` files. Both features are additive -- they extend existing flows without breaking backward compatibility.

The `--spec` flag mirrors the pattern already established in `/rapid:new-version`, where spec content is parsed, tagged with `[FROM SPEC]`, and passed to research agents with a "critically evaluate" framing. The init SKILL.md will gain argument parsing (Step 0.5) and spec-aware discovery bypass logic, and the six research role modules will be updated to accept and tag spec-sourced assertions. The principles feature is self-contained: a new `src/lib/principles.cjs` module handles generation, parsing, and compact summarization, while `generateScopedClaudeMd()` in `src/lib/worktree.cjs` gains an optional principles section. All principles-related code paths degrade gracefully when `PRINCIPLES.md` does not exist.

The two features share no code dependencies and can be developed in parallel waves. The only shared touchpoint is the init SKILL.md, which receives both the `--spec` argument parsing and the principles interview step -- these are sequenced in the init flow (spec at the start, principles after discovery confirmation) so they do not conflict.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/principles.cjs | Core module: generatePrinciplesMd(), generateClaudeMdSection(), loadPrinciples() | New |
| src/lib/principles.test.cjs | Unit tests for principles.cjs | New |
| src/lib/worktree.cjs | Extend generateScopedClaudeMd() with principles awareness | Existing (modify) |
| skills/init/SKILL.md | Add --spec argument parsing and principles interview step | Existing (modify) |
| src/modules/roles/role-research-stack.md | Accept spec content with [FROM SPEC] tagging | Existing (modify) |
| src/modules/roles/role-research-architecture.md | Accept spec content with [FROM SPEC] tagging | Existing (modify) |
| src/modules/roles/role-research-features.md | Accept spec content with [FROM SPEC] tagging | Existing (modify) |
| src/modules/roles/role-research-pitfalls.md | Accept spec content with [FROM SPEC] tagging | Existing (modify) |
| src/modules/roles/role-research-ux.md | Accept spec content with [FROM SPEC] tagging | Existing (modify) |
| src/modules/roles/role-research-oversights.md | Accept spec content with [FROM SPEC] tagging | Existing (modify) |

## Integration Points

- **Exports:**
  - `generatePrinciplesMd(principlesData)` -- produces full PRINCIPLES.md content from structured data
  - `generateClaudeMdSection(principlesData)` -- produces compact summary (max 15 lines) for CLAUDE.md injection
  - `loadPrinciples(cwd)` -- reads and parses PRINCIPLES.md, returns null if absent
  - `principlesAwareScopedClaudeMd` -- extended `generateScopedClaudeMd()` that includes principles section
  - `specFlag` -- `/rapid:init --spec <path>` argument for seeding research with prior findings
- **Imports:** None -- this set is fully independent with no cross-set dependencies
- **Side Effects:**
  - Init flow writes `.planning/PRINCIPLES.md` when principles are captured
  - Worktree CLAUDE.md files gain a new "Principles" section when PRINCIPLES.md exists
  - Research agent outputs may contain `[FROM SPEC]` tags when spec content is provided

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| CLAUDE.md principles section exceeds 15-line budget, bloating agent context | Medium | Enforce via unit test in principles.test.cjs; generateClaudeMdSection() truncates and points to full PRINCIPLES.md |
| Spec content accepted uncritically by research agents, producing biased outputs | High | Mandate "evaluate critically" framing in research role modules; tag all spec-derived assertions with [FROM SPEC] so synthesizer can distinguish |
| Principles interview adds friction to init flow for users who want fast setup | Medium | Provide "Use sensible defaults" escape hatch that skips interview entirely |
| Modifying 6 research role .md files creates broad surface area for regressions | Low | Changes to role modules are additive (new optional input section); existing behavior unchanged when spec is not provided |
| generateScopedClaudeMd() modification could break existing worktree setup | Medium | loadPrinciples() returns null gracefully; principles section only added when PRINCIPLES.md exists; existing tests remain green |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- Create `principles.cjs` module with generatePrinciplesMd(), generateClaudeMdSection(), loadPrinciples() and full unit test coverage
- **Wave 2:** Integration -- Add --spec argument parsing to init SKILL.md; update 6 research role modules with spec-aware input sections and [FROM SPEC] tagging; add principles interview step to init SKILL.md after discovery confirmation
- **Wave 3:** Scoped CLAUDE.md -- Extend generateScopedClaudeMd() in worktree.cjs to include principles summary when PRINCIPLES.md exists; verify graceful degradation

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
