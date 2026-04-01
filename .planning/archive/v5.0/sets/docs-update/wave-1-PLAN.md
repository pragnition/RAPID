# PLAN: docs-update -- Wave 1

**Objective:** Produce a structured gap analysis artifact that catalogs every discrepancy between the current documentation (DOCS.md, technical_documentation.md) and the actual v5.0 codebase. This artifact is consumed by Waves 2 and 3 as the authoritative change list.

**Output:** `.planning/sets/docs-update/GAP-ANALYSIS.md`

---

## Task 1: Audit DOCS.md Against v5.0 Codebase

**Action:** Read DOCS.md in full. Cross-reference every section against the actual codebase (skills/, agents/, src/, docs/) to identify stale content. Organize findings by feature area.

**Feature areas to check:**
1. **State Machine** (line ~452): Compare status names (`discussing`, `planning`, `executing`) against `src/lib/state-transitions.cjs` and `src/lib/state-schemas.cjs`. The actual code uses past-tense names (`discussed`, `planned`, `executed`). Note missing transitions: `pending->planned` shortcut, `discussed->discussed` self-loop, `executed->executed` self-loop, solo mode `complete->merged` auto-transition.
2. **Command Catalog**: Verify every `/rapid:*` skill listed in DOCS.md exists in `skills/`. Verify no skill directory is missing from DOCS.md. Cross-check against the 28 skill directories.
3. **Agent Count and Categories**: Verify "27 agents" and "7 categories" claims against `agents/` directory contents. Verify category breakdown (Core 4, Research 7, Review 7, Merge 2, Utility 6, Context 1).
4. **File Structure Tree** (lines 469-512): Compare the tree against actual directory listing. Note any missing or extra entries.
5. **Review Pipeline**: Verify the 4-skill split description matches current implementation (review, unit-test, bug-hunt, uat).
6. **v5.0 Features**: Check for missing features: UAT workflow rewrite (plan-generation-only, human-verified loop, UAT-FAILURES.md), bug-fix `--uat` flag, branding server (`branding-server.cjs`), generous planning granularity prompt.
7. **Cross-references**: Check that all 11 docs/ files are linked from DOCS.md.

**Verification:** The output section for DOCS.md in GAP-ANALYSIS.md must list at least the known issues (state machine names, missing v5.0 features) plus any additional findings.

---

## Task 2: Audit technical_documentation.md Against v5.0 Codebase

**Action:** Read technical_documentation.md in full. Cross-reference every section against the actual codebase. Organize findings by the same feature areas.

**Feature areas to check:**
1. **Version References**: Find all occurrences of "v3.0", "26 agents", and other version-specific claims. List each line number and the correct v5.0 value.
2. **Agent Catalog**: Compare the documented agent list against the 27 `.md` files in `agents/`. Identify `rapid-auditor` as missing (added v4.2.1). Verify Utility category count should be 6 (not 5) and total categories should be 7 (not 6, Context is the 7th).
3. **Command Reference**: Compare documented commands against the 28 skill directories. List the 10 missing commands: bug-fix, branding, scaffold, audit-version, migrate, documentation, register-web, unit-test, bug-hunt, uat.
4. **State Machine**: Compare against `docs/state-machines.md` (the canonical reference). Note present-tense vs past-tense status names, missing transitions (pending->planned, self-loops, solo mode).
5. **Review Pipeline**: Document that the current single `/rapid:review` description is wrong -- actual v4.4+: 4 separate skills (review, unit-test, bug-hunt, uat). Review only produces REVIEW-SCOPE.md; downstream skills consume independently.
6. **Configuration**: Check for missing env vars (NO_COLOR, RAPID_WEB), missing config.json keys (model_profile, granularity, workflow.research, workflow.plan_check, workflow.verifier, lock_timeout_ms, solo), missing flags (--gaps, --spec, --skip semantics).
7. **Merge Pipeline**: Check for missing solo mode handling, DAG-ordered merging, MERGE-STATE.json, bisection recovery.
8. **Mission Control**: Note the entirely absent v4.0 web dashboard section.
9. **Missing Systems**: Gap-closure mode, memory system, hook system, quality profiles, UI contracts, branding system, RAPID:RETURN protocol, DAG.json, worktree registry, DEFERRED.md auto-discovery.
10. **Spawn Hierarchy**: Compare the documented spawn tree against `docs/agents.md` for completeness.

**Verification:** The output section for technical_documentation.md must catalog all 9 gap categories (A through I from the research findings) with specific line references.

---

## Task 3: Write GAP-ANALYSIS.md

**Action:** Combine findings from Tasks 1 and 2 into a structured artifact at `.planning/sets/docs-update/GAP-ANALYSIS.md`.

**Format:**

```markdown
# Gap Analysis: docs-update

## DOCS.md Gaps

### State Machine
- Line X: "discussing" should be "discussed" (per state-transitions.cjs)
- ...

### Command Catalog
- Missing: ...
- Stale: ...

### [repeat per feature area]

## technical_documentation.md Gaps

### Version References
- Line 3: "v3.0" -> "v5.0"
- ...

### [repeat per feature area]

## Cross-Reference Checklist
- [ ] DOCS.md links to all 11 docs/ files
- [ ] technical_documentation.md links to all 11 docs/ files
- [ ] Explicit cross-references between DOCS.md and technical_documentation.md
```

**Verification:**
- `grep -c "###" .planning/sets/docs-update/GAP-ANALYSIS.md` returns at least 10 (feature area headers)
- The file contains sections for both DOCS.md and technical_documentation.md
- Each gap has a specific line number or line range reference

---

## Success Criteria

1. GAP-ANALYSIS.md exists at `.planning/sets/docs-update/GAP-ANALYSIS.md`
2. Every known gap from the research findings is accounted for
3. Gaps are organized by feature area (not by line number)
4. Each gap entry includes: current text, correct text, source of truth reference
5. The artifact is actionable -- Waves 2 and 3 executors can work directly from it without re-reading the codebase
