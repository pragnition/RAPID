# REVIEW-SCOPE: agent-prompts

<!-- SCOPE-META {"setId":"agent-prompts","date":"2026-03-19T12:00:00.000Z","postMerge":false,"worktreePath":".","totalFiles":15,"useConcernScoping":true} -->

## Set Metadata
| Field | Value |
|-------|-------|
| Set ID | agent-prompts |
| Date | 2026-03-19T12:00:00.000Z |
| Post-Merge | false |
| Worktree Path | . |
| Total Files | 15 |
| Concern Scoping | true |

## Changed Files
| File | Wave Attribution |
|------|-----------------|
| `agents/rapid-executor.md` | wave-1 |
| `agents/rapid-planner.md` | wave-1 |
| `skills/discuss-set/SKILL.md` | wave-1 |
| `src/commands/plan.cjs` | wave-1 |
| `src/lib/tool-docs.cjs` | wave-1 |
| `src/lib/tool-docs.test.cjs` | wave-1 |

## Dependent Files
| File |
|------|
| `src/bin/rapid-tools.cjs` |
| `src/commands/build-agents.cjs` |
| `src/lib/compaction.cjs` |
| `src/lib/memory.cjs` |
| `src/lib/memory.test.cjs` |
| `src/lib/quality.cjs` |
| `src/lib/quality.test.cjs` |
| `src/lib/ui-contract.cjs` |
| `src/lib/ui-contract.test.cjs` |

## Directory Chunks
### Chunk 1: agents
- `agents/rapid-executor.md`
- `agents/rapid-planner.md`

### Chunk 2: skills/discuss-set
- `skills/discuss-set/SKILL.md`

### Chunk 3: src/bin
- `src/bin/rapid-tools.cjs`

### Chunk 4: src/commands
- `src/commands/plan.cjs`
- `src/commands/build-agents.cjs`

### Chunk 5: src/lib
- `src/lib/tool-docs.cjs`
- `src/lib/tool-docs.test.cjs`
- `src/lib/compaction.cjs`
- `src/lib/memory.cjs`
- `src/lib/memory.test.cjs`
- `src/lib/quality.cjs`
- `src/lib/quality.test.cjs`
- `src/lib/ui-contract.cjs`
- `src/lib/ui-contract.test.cjs`

## Wave Attribution
| File | Wave |
|------|------|
| `agents/rapid-executor.md` | wave-1 |
| `agents/rapid-planner.md` | wave-1 |
| `skills/discuss-set/SKILL.md` | wave-1 |
| `src/commands/plan.cjs` | wave-1 |
| `src/lib/tool-docs.cjs` | wave-1 |
| `src/lib/tool-docs.test.cjs` | wave-1 |

## Concern Scoping

### Concern 1: agent-assembly
| File | Rationale |
|------|-----------|
| `agents/rapid-executor.md` | Hand-written core agent prompt for executor role (CORE-tagged, not overwritten by build-agents) |
| `agents/rapid-planner.md` | Hand-written core agent prompt for planner role (CORE-tagged, not overwritten by build-agents) |
| `src/commands/build-agents.cjs` | CLI command that assembles agent .md files from modules, uses tool-docs for role mappings and tool doc injection |
| `src/lib/tool-docs.cjs` | TOOL_REGISTRY static command catalog, ROLE_TOOL_MAP, getToolDocsForRole, estimateTokens -- primary consumer is build-agents |
| `src/lib/tool-docs.test.cjs` | Tests for TOOL_REGISTRY structure, ROLE_TOOL_MAP coverage, getToolDocsForRole output, and CLI drift guard |

### Concern 2: agent-skill-definition
| File | Rationale |
|------|-----------|
| `skills/discuss-set/SKILL.md` | Standalone skill prompt for the discuss-set interactive workflow, consumed directly by Claude Code skill system |

### Concern 3: context-management
| File | Rationale |
|------|-----------|
| `src/lib/compaction.cjs` | Context compaction library -- digest resolution, token budgeting, compaction triggers for reducing agent context size |
| `src/lib/memory.cjs` | Persistent decision/correction memory (JSONL append, query, buildMemoryContext) for cross-session agent learning |
| `src/lib/memory.test.cjs` | Tests for memory append, query, context building, category/source validation, and token budget enforcement |

### Concern 4: quality-system
| File | Rationale |
|------|-----------|
| `src/lib/quality.cjs` | Quality profile management -- loads/creates QUALITY.md and PATTERNS.md, builds quality context, enforces quality gates |
| `src/lib/quality.test.cjs` | Tests for loadQualityProfile, buildQualityContext, checkQualityGates including directory creation and token budgets |

### Concern 5: ui-contract-system
| File | Rationale |
|------|-----------|
| `src/lib/ui-contract.cjs` | UI design contract validation via JSON Schema (Ajv), cross-set consistency checking, and context string building |
| `src/lib/ui-contract.test.cjs` | Tests for validateUiContract, checkUiConsistency, buildUiContext including schema validation and conflict detection |

### Concern 6: cli-infrastructure
| File | Rationale |
|------|-----------|
| `src/bin/rapid-tools.cjs` | Main CLI entry point -- imports all command handlers, parses args, dispatches to subcommand modules |
| `src/commands/plan.cjs` | Plan command handler -- routes plan subcommands (create-set, decompose, write-dag, list-sets, load-set) to plan library |

## Acceptance Criteria
1. [wave-1] `plan-check-gate` no longer exists in TOOL_REGISTRY or plan.cjs error message
2. [wave-1] Executor agent has all 7 ROLE_TOOL_MAP commands in its `<tools>` section
3. [wave-1] Planner agent has all 11 ROLE_TOOL_MAP commands in its `<tools>` section
4. [wave-1] discuss-set SKILL.md Step 5 lists exactly 4 options (no 5th)
5. [wave-1] discuss-set Key Principles says "Exactly 4 gray areas"
6. [wave-1] discuss-set Anti-Patterns says "fewer or more than 4"
7. [wave-1] `node --test src/lib/tool-docs.test.cjs` passes with all new tests green
8. [wave-1] No existing tests broken
9. [wave-2] `build-agents` runs successfully, producing 22 generated agents and skipping 4
10. [wave-2] All 26 agent files exist in `agents/`
11. [wave-2] No agent `<tools>` section references a key not in TOOL_REGISTRY
12. [wave-2] The 4 hand-written agents are preserved (not overwritten)
13. [wave-2] discuss-set SKILL.md has exactly 4 options in Step 5
14. [wave-2] `node --test src/lib/tool-docs.test.cjs` passes all tests (including new drift and guard tests)
15. [wave-2] Full test suite passes with exit code 0
