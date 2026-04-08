# SET-OVERVIEW: audit-handoff

## Approach

This set bridges the gap between audit discovery and set creation by introducing a **remediation artifact** -- a structured JSON file that persists on disk in `.planning/pending-sets/`. When `audit-version` identifies gaps (uncovered or partial requirements), it currently tells the user to manually run `/rapid:add-set` with a scope description. This set automates that handoff: audit-version writes a machine-readable artifact, and add-set auto-discovers it to pre-populate the new set's scope, files, and dependencies.

The implementation follows a "sidecar file" strategy that deliberately avoids touching STATE.json or the Zod schema layer. Remediation artifacts live entirely on disk as standalone JSON files, meaning they survive `/clear` resets and require zero schema migration. A new `src/lib/remediation.cjs` module provides the CRUD interface (write, read, list, delete), which both skill files then import. The status skill gains a small addition to surface pending remediations in the dashboard.

As a secondary concern, this set synchronizes the Node.js minimum version references from the current inconsistent state (>=20 in package.json, v18+ in setup.sh, 20+ in README badge) to a uniform >=22 across all three locations.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/remediation.cjs` | CRUD module for `.planning/pending-sets/` artifacts | New |
| `tests/remediation.test.cjs` | Unit tests for the remediation module | New |
| `skills/audit-version/SKILL.md` | Wire artifact writer into remediation decision flow (Step 4) | Existing -- modify |
| `skills/add-set/SKILL.md` | Wire artifact reader with graceful fallback at Step 1 | Existing -- modify |
| `skills/status/SKILL.md` | Add pending remediation count to dashboard output | Existing -- modify |
| `package.json` | Update `engines.node` from `>=20` to `>=22` | Existing -- modify |
| `setup.sh` | Update Node.js version check from 18 to 22 | Existing -- modify |
| `README.md` | Update badge from `20%2B` to `22%2B` and any prose references | Existing -- modify |

## Integration Points

- **Exports:**
  - `writeRemediationArtifact(setName, remediation)` -- writes structured JSON to `.planning/pending-sets/{set-name}.json`
  - `readRemediationArtifact(setName)` -- reads a pending artifact, returns null if absent
  - `listPendingRemediations()` -- lists all pending remediation set names
  - `deleteRemediationArtifact(setName)` -- removes artifact after consumption by add-set
- **Imports:** None -- this set is fully independent (DAG wave 1, no edges)
- **Side Effects:**
  - Creates `.planning/pending-sets/` directory on first write
  - Artifacts persist on disk across `/clear` context resets
  - add-set consumes and deletes artifacts after use (cleanup responsibility)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Skill SKILL.md edits conflict with other wave-1 sets modifying the same files | Medium | OWNERSHIP.json is empty and no other set claims these files; verify before merge |
| `.planning/pending-sets/` directory not created before first read/list call | Low | Guard with `fs.mkdirSync(dir, { recursive: true })` on write; `fs.existsSync` on read/list |
| Stale remediation artifacts accumulate if user never runs add-set | Low | `listPendingRemediations` surfaces them in status dashboard; document manual cleanup |
| Node.js version bump to >=22 breaks CI or contributor environments | Medium | 22 is current LTS; check that tests and CI do not pin an older version |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- create `src/lib/remediation.cjs` with write/read/list/delete functions and `tests/remediation.test.cjs` with full coverage (edge cases: missing directory, malformed JSON, nonexistent artifact)
- **Wave 2:** Skill wiring -- modify `audit-version/SKILL.md` to call `writeRemediationArtifact` during Step 4 remediation decisions; modify `add-set/SKILL.md` to auto-discover artifacts at startup with graceful fallback; modify `status/SKILL.md` to display pending count
- **Wave 3:** Version sync and polish -- update Node.js minimum version in `package.json`, `setup.sh`, and `README.md`; final integration check

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
