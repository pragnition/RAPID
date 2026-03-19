# SET-OVERVIEW: ui-contracts

## Approach

This set introduces a parallel UI specification system alongside the existing CONTRACT.json pipeline. The core artifact is a per-set `UI-CONTRACT.json` file that captures component hierarchy, layout constraints, styling tokens, and interaction patterns -- information that the current contract system (which only tracks function exports, type shapes, and behavioral invariants) cannot represent. The design follows the research recommendation of a separate file rather than extending CONTRACT.json, keeping API and UI concerns cleanly decoupled.

The implementation creates a new `src/lib/ui-contract.cjs` module that mirrors the pattern established by `contract.cjs`: a JSON Schema meta-schema validated by Ajv, a validation function, and utility functions for cross-set consistency checking. A `buildUiContext()` function produces a token-budgeted UI specification string that the executor context pipeline can inject into agent prompts. Three CLI subcommands (`ui-contract validate`, `ui-contract check-consistency`, `ui-contract show`) expose the functionality through `rapid-tools.cjs`.

The key design constraint is non-interference: the existing CONTRACT.json schema, validation gates, and test generation pipeline must remain completely untouched. UI-CONTRACT.json is an optional, additive artifact -- sets without UI simply omit it.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/ui-contract.cjs | Core module: schema, validation, consistency checks, context builder | New |
| src/lib/ui-contract.test.cjs | Unit tests for all exported functions | New |
| src/schemas/ui-contract-schema.json | JSON Schema defining UI-CONTRACT.json structure | New |
| src/bin/rapid-tools.cjs | CLI router -- add ui-contract subcommand dispatch | Existing (modify) |
| src/lib/execute.cjs | Context injection -- wire buildUiContext into enrichedPrepareSetContext | Existing (modify) |

## Integration Points

- **Exports:**
  - `validateUiContract(contract)` -- Ajv validation of a UI-CONTRACT.json object, returns `{ valid, errors? }`
  - `checkUiConsistency(cwd, milestoneId)` -- Cross-set scan for conflicting component names, layout rule contradictions, and incompatible design tokens
  - `buildUiContext(cwd, setName)` -- Produces a formatted string of relevant UI specs for executor prompt injection
  - `ui-contract validate|check-consistency|show` CLI commands via rapid-tools.cjs
  - `src/schemas/ui-contract-schema.json` -- The Ajv-validated JSON Schema itself

- **Imports:** None. This set is fully independent with no dependencies on other v3.4.0 sets.

- **Side Effects:**
  - `enrichedPrepareSetContext()` in execute.cjs gains a `uiContext` field when UI-CONTRACT.json exists for a set
  - New `src/schemas/` directory created (does not exist yet)
  - CLI help text updated with new subcommands

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| UI-CONTRACT.json schema design is speculative -- RAPID itself has no UI, so the schema models hypothetical consumer projects | Medium | Design the schema to be generic (component trees, tokens, layout grids) rather than framework-specific; validate against real-world webapp patterns from research |
| Modifying execute.cjs enrichedPrepareSetContext could conflict with code-quality set's changes to the same function | Medium | The code-quality set is already merged; check the current function signature and add uiContext as a parallel optional field, same pattern as qualityContext |
| Cross-set consistency checking could be expensive for large milestones with many sets | Low | Lazy-load UI contracts only when check-consistency is invoked; cache parsed schemas |
| No programmatic way to verify UI contracts match actual rendered output (unlike function contracts which can check exports exist) | Low | Accept that UI contract validation is structural (schema conformance + cross-set consistency), not behavioral; document this limitation |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- JSON Schema definition (`ui-contract-schema.json`), core validation function (`validateUiContract`), and unit tests proving schema acceptance/rejection
- **Wave 2:** Cross-set features -- `checkUiConsistency` implementation, `buildUiContext` context builder, CLI command wiring in rapid-tools.cjs
- **Wave 3:** Integration -- Wire `buildUiContext` into `enrichedPrepareSetContext` in execute.cjs, end-to-end tests with sample UI-CONTRACT.json files

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
