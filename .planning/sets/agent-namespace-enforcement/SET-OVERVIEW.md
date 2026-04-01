# SET-OVERVIEW: agent-namespace-enforcement

## Approach

The current Namespace Isolation section in `src/modules/core/core-identity.md` gives agents a brief directive to only use `rapid:*` skills and ignore non-RAPID namespaces, but the language is advisory and lacks concrete examples. Agents that encounter ambiguous skill lists in their system context may still attempt to invoke non-RAPID skills because there is no explicit deny-list to anchor the prohibition.

This set strengthens that section with three changes: (1) add an explicit deny-list naming at least three concrete non-RAPID skill/agent namespaces that agents MUST NOT invoke, drawn from real examples visible in system context (e.g., `gsd:*`, `superpowers:*`, `p-research:*`); (2) rewrite the enforcement language from advisory "Ignore them entirely" phrasing to imperative MUST/MUST NOT directives; and (3) optionally add a validation check in the `build-agents` command (`src/commands/build-agents.cjs`) that warns at build time if any role module references a non-`rapid-` agent or non-`rapid:` skill namespace.

After the identity module is updated, all agents must be regenerated via `build-agents` so the strengthened language propagates into every assembled agent prompt. The set is self-contained with no imports from other sets and a single export (the updated `core-identity.md`).

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/modules/core/core-identity.md` | Core identity module injected into every agent -- contains the Namespace Isolation section | Existing (modify) |
| `src/commands/build-agents.cjs` | Agent assembly command -- optional validation check target | Existing (modify, optional) |
| `src/lib/build-agents.test.cjs` | Tests for build-agents -- would need new test if validation is added | Existing (modify, optional) |

## Integration Points

- **Exports:** `strengthenedIdentity` -- the updated `core-identity.md` with deny-list enforcement in the Namespace Isolation section. Every agent assembled by `build-agents` inherits this module, so the change propagates system-wide on next build.
- **Imports:** None. This set has zero external dependencies.
- **Side Effects:** All agents regenerated after merge will contain the strengthened namespace isolation language. No behavioral change for well-behaved agents; agents that were accidentally invoking non-RAPID skills will now have stronger guardrails.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Deny-list examples become stale as plugin ecosystem evolves | Low | Use broad namespace patterns (`gsd:*`, `superpowers:*`) rather than individual skill names; document that list is illustrative, not exhaustive |
| Overly rigid enforcement language confuses agents when legitimate cross-plugin interaction is needed in the future | Medium | Frame deny-list as current policy with clear "If a user's task maps to a non-RAPID skill, find the equivalent `rapid:*` command or report BLOCKED" escape hatch already present |
| Build-agents validation check produces false positives on legitimate references (e.g., documentation mentioning other plugins) | Low | Scope validation to role module content only, exclude comments and documentation strings; make it a warning, not a hard error |

## Wave Breakdown (Preliminary)

- **Wave 1:** Strengthen `core-identity.md` Namespace Isolation section -- add deny-list with 3+ concrete examples, rewrite to imperative MUST/MUST NOT language, ensure the section is self-contained and unambiguous.
- **Wave 2:** (Optional) Add build-agents validation check that scans role modules for non-`rapid-` agent or non-`rapid:` skill references and emits warnings. Add corresponding test coverage.
- **Wave 3:** Regenerate all agents via `build-agents` and verify the updated identity module is present in assembled output.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
