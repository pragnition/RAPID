# Phase 4: Planning Engine and Contracts - Research

**Researched:** 2026-03-04
**Domain:** Set decomposition, JSON Schema contracts, DAG dependency graphs, file ownership
**Confidence:** HIGH

## Summary

Phase 4 builds the planning engine that decomposes a project into parallelizable sets -- independent workstreams each with their own discuss/plan/execute lifecycle. The engine produces three core artifacts: set definitions (DEFINITION.md files with scope, file ownership, and tasks), interface contracts (CONTRACT.json files using JSON Schema), and a dependency DAG (DAG.json showing set ordering and wave grouping). Two new skills (`/rapid:plan` and `/rapid:assumptions`) route through `rapid-tools.cjs` to a new `plan.cjs` library.

The technical domain is well-understood: JSON Schema (draft 2020-12) with Ajv v8 for contract validation, a hand-rolled topological sort for DAG operations (the algorithm is ~40 lines, avoiding a dependency), and the existing `.planning/` directory structure extended with `.planning/sets/`. The planner agent assembles from existing modules and gets a new `role-planner.md` update to handle project-level set decomposition rather than phase-level task breakdown. Contract tests are auto-generated as `.test.cjs` files from each CONTRACT.json schema.

**Primary recommendation:** Build `plan.cjs` as the core library (set creation, contract schema management, DAG operations, ownership maps, contribution manifests), wire it through `rapid-tools.cjs` subcommands, and create `/rapid:plan` and `/rapid:assumptions` skills that orchestrate the full decomposition flow.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Contracts are **JSON Schema** definitions
- Each contract covers **API surfaces + data shapes + behavioral expectations** (full contract)
- Contracts are machine-verifiable via **auto-generated contract tests** -- each contract produces a test file that the executor must make pass
- Contract files live **per-set** (`.planning/sets/<set-name>/CONTRACT.json`) with a **central manifest** (`.planning/contracts/MANIFEST.json`) indexing all contracts (dual-write)
- Sets are **project-level** parallel workstreams -- each set has its own full discuss/plan/execute lifecycle
- The planner **auto-proposes** sets from REQUIREMENTS.md + codebase context (Phase 3 output). Developer reviews and approves the proposed decomposition
- Each set gets a **DEFINITION.md** (scope, file ownership, tasks, acceptance criteria) and a **CONTRACT.json** (JSON Schema interface)
- `/rapid:plan` is the command that triggers decomposition
- **Owner + contributors** model -- every file has exactly one owning set, but other sets can contribute changes
- Contributors declare intended changes in a **CONTRIBUTIONS.json** during planning -- the owner's contract accounts for these, and the merge reviewer uses the manifest to apply changes in order
- **Ownership map is auto-generated** by the planner (developer reviews)
- Ownership violations (modifying an unowned file without a contribution manifest) produce a **warning + log** rather than a hard block -- defers resolution to merge phase
- **Hybrid DAG with wave labels** -- full dependency DAG exists with explicit edges, but sets are also grouped into waves for human readability. Execution follows the DAG (a set runs when its deps complete), waves are visualization
- **Per-wave planning gate** -- Wave 1 sets must all be planned before Wave 1 executes. Wave 2 planning can happen while Wave 1 executes. Overlaps planning and execution for speed
- DAG stored as a **JSON graph file** (`.planning/sets/DAG.json`) with nodes (sets) and edges (dependencies)
- **Soft dependencies via contract stubs** -- if Set A needs Set B's types, Set A codes against the contract stub. Both sets can run in parallel. The contract IS the stub
- Planner produces **wave-end checkpoints** -- which contracts must be satisfied, which artifacts must exist. Reconciliation (Phase 7) validates these checkpoints

### Claude's Discretion
- Internal data structures for representing sets and contracts in memory
- CLI subcommand design for `/rapid:plan` and `/rapid:assumptions`
- Validation error messages and user-facing output format
- How the planner agent analyzes codebase context to propose set boundaries

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAN-01 | Developer can run `/rapid:plan` to decompose work into parallelizable sets with explicit boundaries | New `plan` skill in `rapid/skills/plan/SKILL.md` + `plan` command in `rapid/commands/plan.md` routing through `rapid-tools.cjs plan` subcommands to `plan.cjs` library. Planner agent reads REQUIREMENTS.md + context files, proposes sets with DEFINITION.md per set |
| PLAN-02 | Each set has a machine-verifiable interface contract defining API surfaces, data shapes, and behavioral expectations | JSON Schema (draft 2020-12) CONTRACT.json files per set, validated by Ajv v8. Auto-generated `.test.cjs` contract test files using `node:test` + Ajv compilation |
| PLAN-03 | Planning produces a set dependency graph (DAG) showing which sets can run in parallel and which have ordering constraints | DAG.json with nodes/edges format. Hand-rolled topological sort with cycle detection (~40 lines). Wave grouping derived from DAG levels |
| PLAN-04 | Planning assigns shared-file ownership to specific sets to prevent merge conflicts | Ownership map in `.planning/sets/OWNERSHIP.json` mapping file paths to owning set names. CONTRIBUTIONS.json per contributing set for cross-set file changes |
| PLAN-05 | Developer can run `/rapid:assumptions` to surface Claude's mental model about a set | New `assumptions` skill in `rapid/skills/assumptions/SKILL.md` + `assumptions` command routing through `rapid-tools.cjs assumptions`. Reads set DEFINITION.md + CONTRACT.json, outputs structured assumptions for developer review |
| PLAN-06 | Planning respects loose sync gates -- shared planning gate must complete before any set begins execution | Gate state tracked in `.planning/sets/GATES.json` with per-wave planning completion flags. `plan.cjs` provides `checkPlanningGate(wave)` function that returns whether all sets in a wave are planned |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Ajv | 8.17.1 | JSON Schema validation | De facto standard for Node.js JSON Schema validation. Compiles schemas to optimized validation functions. 180+ code snippets in Context7. HIGH confidence |
| ajv/dist/standalone | (included in Ajv) | Generate standalone validation code from schemas | Compile-time code generation eliminates runtime Ajv dependency for contract test files |
| node:test | built-in (Node.js 18+) | Test runner for contract tests | Already used throughout the project. Zero dependency. Matches existing `*.test.cjs` pattern |
| node:assert/strict | built-in | Assertions for contract tests | Already used in all existing tests |
| node:fs, node:path | built-in | File system operations | Standard Node.js. All existing modules use these |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ajv-formats | 3.0.1 | Extended format validation (date, email, uri, etc.) | When contracts define string formats beyond basic types. Install only if needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled toposort | `toposort` npm package | toposort is ~75 lines, zero deps. Hand-rolling avoids adding a dependency for a trivial algorithm. The project has zero npm dependencies currently (pure Node.js built-ins) -- maintaining this is valuable |
| Ajv | `zod` or `joi` | Ajv is JSON Schema standard compliant (can load/save .json schemas). Zod/Joi are code-first validators that can't roundtrip as JSON files. Decision is locked to JSON Schema |
| Custom DAG format | graphology/graphology-dag | graphology is a full graph library (~50KB). Overkill for a simple DAG with <20 nodes. Hand-rolled JSON format is more readable and self-documenting |

**Installation:**
```bash
npm install ajv ajv-formats
```

**Note:** This will be the project's first npm dependency. Consider whether `ajv` should live in `rapid/package.json` (tool-only dependency) rather than the user's project `package.json`. Recommendation: create `rapid/package.json` for tool dependencies, keeping the user's project clean.

## Architecture Patterns

### Recommended Project Structure
```
rapid/
├── src/
│   ├── lib/
│   │   ├── plan.cjs              # Core planning library (new)
│   │   ├── plan.test.cjs         # Tests for plan.cjs (new)
│   │   ├── contract.cjs          # Contract schema management (new)
│   │   ├── contract.test.cjs     # Tests for contract.cjs (new)
│   │   ├── dag.cjs               # DAG operations + toposort (new)
│   │   ├── dag.test.cjs          # Tests for dag.cjs (new)
│   │   └── ... (existing libs)
│   ├── bin/
│   │   └── rapid-tools.cjs       # Extended with plan/assumptions commands
│   └── modules/
│       └── roles/
│           └── role-planner.md   # Updated for project-level set decomposition
├── commands/
│   ├── plan.md                   # Legacy command registration (new)
│   └── assumptions.md            # Legacy command registration (new)
├── skills/
│   ├── plan/
│   │   └── SKILL.md              # /rapid:plan skill (new)
│   └── assumptions/
│       └── SKILL.md              # /rapid:assumptions skill (new)
└── config.json                   # Unchanged (agents already defined)

.planning/
├── sets/
│   ├── DAG.json                  # Dependency graph (new)
│   ├── OWNERSHIP.json            # File ownership map (new)
│   ├── GATES.json                # Sync gate state (new)
│   ├── <set-name>/
│   │   ├── DEFINITION.md         # Set scope, tasks, criteria
│   │   ├── CONTRACT.json         # JSON Schema interface contract
│   │   └── CONTRIBUTIONS.json    # Cross-set file contributions (if contributor)
│   └── <set-name>/
│       ├── DEFINITION.md
│       └── CONTRACT.json
└── contracts/
    └── MANIFEST.json             # Central index of all contracts (dual-write)
```

### Pattern 1: Set Definition Structure
**What:** Each set gets a DEFINITION.md with standardized sections
**When to use:** Always -- every set produced by the planner
**Example:**
```markdown
# Set: auth-system

## Scope
Authentication and authorization module including login, session management,
and role-based access control.

## File Ownership
Files this set owns (exclusive write access):
- src/auth/**
- src/middleware/auth.js
- tests/auth/**

## Tasks
1. Implement JWT token generation and validation
   - Acceptance: `node --test tests/auth/jwt.test.cjs` passes
2. Add login/logout API endpoints
   - Acceptance: `node --test tests/auth/api.test.cjs` passes

## Interface Contract
See: CONTRACT.json (adjacent file)

## Wave Assignment
Wave: 1 (parallel with: ui-shell, data-layer)

## Acceptance Criteria
- All tasks complete with passing tests
- CONTRACT.json satisfied (validated by contract test)
- No ownership violations logged
```

### Pattern 2: CONTRACT.json Schema Structure
**What:** JSON Schema defining the contract between sets
**When to use:** Every set that exposes or consumes interfaces
**Example:**
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "rapid://contracts/auth-system",
  "title": "auth-system Contract",
  "description": "Interface contract for the auth-system set",
  "type": "object",
  "properties": {
    "exports": {
      "type": "object",
      "description": "What this set provides to other sets",
      "properties": {
        "functions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "file": { "type": "string" },
              "params": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "name": { "type": "string" },
                    "type": { "type": "string" }
                  },
                  "required": ["name", "type"]
                }
              },
              "returns": { "type": "string" }
            },
            "required": ["name", "file", "params", "returns"]
          }
        },
        "types": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "file": { "type": "string" },
              "shape": { "type": "object" }
            },
            "required": ["name", "file", "shape"]
          }
        }
      }
    },
    "imports": {
      "type": "object",
      "description": "What this set consumes from other sets",
      "properties": {
        "fromSets": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "set": { "type": "string" },
              "functions": { "type": "array", "items": { "type": "string" } },
              "types": { "type": "array", "items": { "type": "string" } }
            },
            "required": ["set"]
          }
        }
      }
    },
    "behavioral": {
      "type": "object",
      "description": "Behavioral expectations for this set",
      "properties": {
        "invariants": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Conditions that must always hold"
        },
        "sideEffects": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Observable side effects this set produces"
        }
      }
    }
  },
  "required": ["exports"]
}
```

### Pattern 3: DAG.json Graph Format
**What:** Directed acyclic graph representing set dependencies with wave labels
**When to use:** Created once during planning, read by execution engine
**Example:**
```json
{
  "nodes": [
    { "id": "auth-system", "wave": 1, "status": "planned" },
    { "id": "data-layer", "wave": 1, "status": "planned" },
    { "id": "api-gateway", "wave": 2, "status": "pending" }
  ],
  "edges": [
    { "from": "auth-system", "to": "api-gateway" },
    { "from": "data-layer", "to": "api-gateway" }
  ],
  "waves": {
    "1": {
      "sets": ["auth-system", "data-layer"],
      "checkpoint": {
        "contracts": ["rapid://contracts/auth-system", "rapid://contracts/data-layer"],
        "artifacts": [".planning/sets/auth-system/CONTRACT.json", ".planning/sets/data-layer/CONTRACT.json"]
      }
    },
    "2": {
      "sets": ["api-gateway"],
      "checkpoint": {
        "contracts": ["rapid://contracts/api-gateway"],
        "artifacts": [".planning/sets/api-gateway/CONTRACT.json"]
      }
    }
  },
  "metadata": {
    "created": "2026-03-04",
    "totalSets": 3,
    "totalWaves": 2,
    "maxParallelism": 2
  }
}
```

### Pattern 4: OWNERSHIP.json Format
**What:** Maps every owned file path to its owning set
**When to use:** Created during planning, checked during execution and merge
**Example:**
```json
{
  "version": 1,
  "generated": "2026-03-04",
  "ownership": {
    "src/auth/**": "auth-system",
    "src/middleware/auth.js": "auth-system",
    "src/data/**": "data-layer",
    "src/api/**": "api-gateway",
    "package.json": "data-layer",
    "tsconfig.json": "auth-system"
  }
}
```

### Pattern 5: CONTRIBUTIONS.json Format
**What:** Declares cross-set file modifications with intent
**When to use:** When a set needs to modify a file owned by another set
**Example:**
```json
{
  "set": "api-gateway",
  "contributesTo": [
    {
      "file": "package.json",
      "owner": "data-layer",
      "intent": "Add express and cors dependencies",
      "section": "dependencies",
      "priority": 2
    }
  ]
}
```

### Pattern 6: MANIFEST.json Central Index
**What:** Central index of all contracts for quick lookup
**When to use:** Created during planning, used by merge reviewer and status commands
**Example:**
```json
{
  "version": 1,
  "generated": "2026-03-04",
  "contracts": [
    {
      "set": "auth-system",
      "path": ".planning/sets/auth-system/CONTRACT.json",
      "schemaId": "rapid://contracts/auth-system",
      "wave": 1,
      "exports": ["authenticateUser", "validateToken", "AuthToken"],
      "consumers": ["api-gateway"]
    },
    {
      "set": "data-layer",
      "path": ".planning/sets/data-layer/CONTRACT.json",
      "schemaId": "rapid://contracts/data-layer",
      "wave": 1,
      "exports": ["createRecord", "queryRecords", "DataRecord"],
      "consumers": ["api-gateway"]
    }
  ]
}
```

### Pattern 7: GATES.json Sync Gate State
**What:** Tracks planning/execution gate state per wave
**When to use:** Checked before execution begins for any set
**Example:**
```json
{
  "version": 1,
  "gates": {
    "wave-1": {
      "planning": {
        "required": ["auth-system", "data-layer"],
        "completed": ["auth-system", "data-layer"],
        "status": "open"
      },
      "execution": {
        "status": "ready"
      }
    },
    "wave-2": {
      "planning": {
        "required": ["api-gateway"],
        "completed": [],
        "status": "blocked"
      },
      "execution": {
        "status": "blocked"
      }
    }
  }
}
```

### Pattern 8: Auto-Generated Contract Test
**What:** Test file generated from CONTRACT.json that validates the contract is satisfied
**When to use:** Generated during planning, executed during verification
**Example:**
```javascript
// AUTO-GENERATED from .planning/sets/auth-system/CONTRACT.json
// Do not edit manually -- regenerate with: rapid-tools contract generate-test auth-system
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Contract: auth-system', () => {
  const contractPath = path.resolve(__dirname, 'CONTRACT.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));

  describe('Exported functions exist', () => {
    for (const fn of contract.exports.functions) {
      it(`exports ${fn.name} from ${fn.file}`, () => {
        const filePath = path.resolve(__dirname, '../../..', fn.file);
        assert.ok(fs.existsSync(filePath), `File ${fn.file} must exist`);
        const mod = require(filePath);
        assert.ok(typeof mod[fn.name] === 'function', `${fn.name} must be exported as a function`);
      });
    }
  });

  describe('Exported types have correct shape', () => {
    // Ajv validation of type shapes against schema
    const Ajv = require('ajv');
    const ajv = new Ajv({ allErrors: true });

    for (const type of contract.exports.types) {
      it(`type ${type.name} matches schema in ${type.file}`, () => {
        const filePath = path.resolve(__dirname, '../../..', type.file);
        assert.ok(fs.existsSync(filePath), `File ${type.file} must exist`);
        // Schema validation of exported shape
        const validate = ajv.compile(type.shape);
        // Type shape is validated structurally, not at runtime
        assert.ok(validate, `Schema for ${type.name} must compile`);
      });
    }
  });
});
```

### Anti-Patterns to Avoid
- **Monolithic planning:** Do not create one giant PLAN.md. Each set gets its own DEFINITION.md + CONTRACT.json. Keeps sets truly independent.
- **Implicit dependencies:** Every dependency between sets MUST be an explicit edge in DAG.json. No "oh, this set also needs that" after execution begins.
- **Shared file free-for-all:** Never allow multiple sets to modify the same file without an explicit CONTRIBUTIONS.json. This is the primary source of merge conflicts.
- **Over-specified contracts:** Contracts define interfaces, not implementations. Don't put implementation details in CONTRACT.json. Keep it to function signatures, type shapes, and behavioral invariants.
- **Circular contract references:** If Set A imports from Set B and Set B imports from Set A, the DAG has a cycle. The planner must detect and reject this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation | Custom schema parser/validator | Ajv v8 (npm: `ajv`) | JSON Schema has 30+ keywords, edge cases in `$ref` resolution, format validation. Ajv handles draft-04 through 2020-12 |
| Schema format validation | String regex for emails/dates/URIs | ajv-formats (npm: `ajv-formats`) | RFC-compliant format validation with proper edge cases |
| Schema $ref resolution | Manual JSON pointer traversal | Ajv's built-in `$ref` resolution | Cross-file and in-file references are complex. Ajv handles `$id`, `$defs`, relative and absolute `$ref` |

**Key insight:** JSON Schema validation looks simple but has deep complexity in composition (`allOf`, `oneOf`, `$ref`), format validation, and error reporting. Ajv is the Node.js ecosystem standard for a reason.

**OK to hand-roll:**
| Problem | Why Hand-Rolling is Fine |
|---------|--------------------------|
| Topological sort | Algorithm is ~40 lines. Project currently has zero npm deps. The algorithm is stable and well-understood |
| DAG cycle detection | Trivially done during topological sort (detect back edges in DFS) |
| File ownership map | Simple JSON read/lookup. No library needed |
| Wave grouping from DAG | BFS-based level assignment. ~20 lines of code |
| DEFINITION.md generation | String template. No templating library needed |

## Common Pitfalls

### Pitfall 1: Overly Granular Sets
**What goes wrong:** Planner creates 15+ sets for a 5-requirement project. Each set has only 1-2 files. Contract overhead exceeds the work itself.
**Why it happens:** Decomposition algorithm optimizes too aggressively for parallelism without considering overhead.
**How to avoid:** Set minimum thresholds -- a set should own at least 3-5 files and have at least 2 tasks. The planner should merge tiny sets into their nearest neighbor.
**Warning signs:** Sets with single-file ownership. Sets with no imports/exports (isolated work that could be a task, not a set).

### Pitfall 2: Circular Dependencies in Contract Design
**What goes wrong:** Set A exports a function that takes Set B's type as input, and Set B exports a function that takes Set A's type. The DAG has a cycle.
**Why it happens:** Real codebases have bidirectional relationships (e.g., User owns Posts, Post references User).
**How to avoid:** Extract shared types into a "shared-types" or "core" set that both depend on. The planner should detect cycles during DAG construction and suggest resolution.
**Warning signs:** Topological sort throws a cycle error. Two sets have bidirectional edges.

### Pitfall 3: package.json Merge Conflicts
**What goes wrong:** Three sets all add dependencies to package.json. When merging, every set conflicts on the same file.
**Why it happens:** package.json is a shared file that almost every set needs to modify.
**How to avoid:** Assign package.json ownership to one set (typically "core" or "infrastructure"). Other sets use CONTRIBUTIONS.json to declare what they need added. The merge reviewer applies contributions in order.
**Warning signs:** Multiple sets listing package.json in their file ownership.

### Pitfall 4: Contract Schema Too Rigid
**What goes wrong:** Contract specifies exact parameter names, and when the implementer uses a slightly different name, the contract test fails on structure rather than behavior.
**Why it happens:** Contract author over-specifies implementation details.
**How to avoid:** Contracts define the interface boundary (function exists, accepts N params of types X, returns type Y). Don't constrain internal parameter names unless they're part of a public API.
**Warning signs:** Contract test failures that are about naming rather than behavior.

### Pitfall 5: Planning Gate Deadlock
**What goes wrong:** Wave 2 can't start planning because Wave 1 execution hasn't finished, but Wave 1 execution needs Wave 2's contract stubs.
**Why it happens:** Misunderstanding of the per-wave planning gate. Planning and execution overlap for different waves, not within the same wave.
**How to avoid:** The gate rule is: "All Wave N sets must be PLANNED before any Wave N set EXECUTES." Wave N+1 PLANNING can happen while Wave N EXECUTES. Contract stubs are defined during planning, not execution.
**Warning signs:** Sets marked as "blocked" on a gate that should be open.

### Pitfall 6: Ajv CommonJS Import Issues
**What goes wrong:** `require('ajv')` doesn't work because Ajv v8 ships as ESM by default.
**Why it happens:** Ajv v8 package changed module format between minor versions.
**How to avoid:** Use `const Ajv = require('ajv').default` or `const Ajv = require('ajv/dist/2020').default` for CommonJS. The project is 100% CommonJS (`.cjs` files). Test the import pattern before committing to it.
**Warning signs:** "ERR_REQUIRE_ESM" or "Ajv is not a constructor" errors.

## Code Examples

Verified patterns from official sources:

### Ajv Basic Validation (CommonJS)
```javascript
// Source: Context7 /ajv-validator/ajv, verified against ajv.js.org
const Ajv = require('ajv').default;
const ajv = new Ajv({ allErrors: true });

const schema = {
  type: 'object',
  properties: {
    foo: { type: 'integer' },
    bar: { type: 'string' },
  },
  required: ['foo'],
  additionalProperties: false,
};

const validate = ajv.compile(schema);
const valid = validate(data);
if (!valid) console.log(validate.errors);
```

### Ajv Standalone Code Generation (for contract tests)
```javascript
// Source: Context7 /ajv-validator/ajv standalone.md
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv').default;
const standaloneCode = require('ajv/dist/standalone').default;

const schema = {
  $id: 'rapid://contracts/auth-system',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    bar: { type: 'string' },
  },
  required: ['bar'],
};

const ajv = new Ajv({ code: { source: true } });
const validate = ajv.compile(schema);
const moduleCode = standaloneCode(ajv, validate);

// Write standalone validation module (no Ajv dependency at runtime)
fs.writeFileSync(path.join(__dirname, 'validate-auth.cjs'), moduleCode);
```

### Hand-Rolled Topological Sort (for DAG)
```javascript
// Source: Algorithm is standard Kahn's algorithm (BFS-based)
// No external dependency needed

/**
 * Topological sort with cycle detection.
 * @param {Array<{id: string}>} nodes - Graph nodes
 * @param {Array<{from: string, to: string}>} edges - Directed edges
 * @returns {string[]} Sorted node IDs
 * @throws {Error} If cycle detected
 */
function toposort(nodes, edges) {
  const inDegree = {};
  const adjacency = {};

  for (const node of nodes) {
    inDegree[node.id] = 0;
    adjacency[node.id] = [];
  }

  for (const edge of edges) {
    adjacency[edge.from].push(edge.to);
    inDegree[edge.to]++;
  }

  // Start with nodes that have no incoming edges
  const queue = [];
  for (const node of nodes) {
    if (inDegree[node.id] === 0) queue.push(node.id);
  }

  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);

    for (const neighbor of adjacency[current]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== nodes.length) {
    const remaining = nodes.map(n => n.id).filter(id => !sorted.includes(id));
    throw new Error(`Cycle detected involving: ${remaining.join(', ')}`);
  }

  return sorted;
}
```

### Wave Assignment from DAG
```javascript
// Source: Standard BFS level assignment algorithm

/**
 * Assign wave numbers to nodes based on DAG levels.
 * Wave 1 = nodes with no dependencies, Wave 2 = depends only on Wave 1, etc.
 * @param {Array<{id: string}>} nodes
 * @param {Array<{from: string, to: string}>} edges
 * @returns {Object} Map of nodeId -> wave number
 */
function assignWaves(nodes, edges) {
  const waves = {};
  const inDegree = {};
  const adjacency = {};

  for (const node of nodes) {
    inDegree[node.id] = 0;
    adjacency[node.id] = [];
  }

  for (const edge of edges) {
    adjacency[edge.from].push(edge.to);
    inDegree[edge.to]++;
  }

  let currentWave = 1;
  let queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);

  while (queue.length > 0) {
    const nextQueue = [];
    for (const nodeId of queue) {
      waves[nodeId] = currentWave;
      for (const neighbor of adjacency[nodeId]) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) nextQueue.push(neighbor);
      }
    }
    queue = nextQueue;
    currentWave++;
  }

  return waves;
}
```

### Library Module Pattern (matching existing codebase)
```javascript
// Source: Existing pattern from core.cjs, state.cjs, verify.cjs
'use strict';

const fs = require('fs');
const path = require('path');

// ... functions ...

module.exports = { functionA, functionB, functionC };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON Schema draft-07 | JSON Schema draft 2020-12 | 2020 | New keywords: `$defs` replaces `definitions`, `prefixItems` replaces tuple `items` |
| Ajv v6 | Ajv v8 | 2021 | ESM-first, TypeScript types included, standalone code generation, draft 2020-12 support |
| `require('ajv')` | `require('ajv').default` | Ajv v8 | CommonJS import changed due to ESM module interop. Must use `.default` |

**Deprecated/outdated:**
- `definitions` keyword: Use `$defs` instead (JSON Schema 2020-12)
- `items` for tuple validation: Use `prefixItems` instead (2020-12)
- Ajv v6 API: Constructor options changed, `addSchema` behavior differs

## Open Questions

1. **Ajv in CommonJS: exact import path**
   - What we know: Ajv v8 ships ESM by default, but provides CJS compatibility
   - What's unclear: Whether `require('ajv').default` or `require('ajv/dist/2020').default` is the correct CJS import path in 2026
   - Recommendation: Test the import in a small script during Wave 0. Fall back to `require('ajv/dist/2019')` if 2020 is unavailable. LOW confidence on exact path -- must verify at implementation time

2. **Contract test generation complexity**
   - What we know: We can generate tests that check function existence and schema compilation
   - What's unclear: How deep behavioral expectations can go in auto-generated tests (e.g., "function returns a promise" vs "function handles errors correctly")
   - Recommendation: Start with structural tests (exports exist, types match shapes). Behavioral tests are better written by the executor as part of implementation. Keep auto-generated tests focused on contract surface verification

3. **Ownership map glob vs explicit paths**
   - What we know: File ownership needs to handle both specific files (`package.json`) and patterns (`src/auth/**`)
   - What's unclear: Whether minimatch/glob patterns are worth the complexity vs explicit path lists
   - Recommendation: Start with explicit paths. If the planner needs to express "all files under src/auth/", use `src/auth/**` with Node.js built-in `path.relative()` checks. Avoid adding a glob dependency -- simple `startsWith` matching on directory prefixes covers 90% of cases

4. **Planner agent prompt size**
   - What we know: The planner needs REQUIREMENTS.md + context files + codebase structure + role instructions
   - What's unclear: Whether this exceeds the agent_size_warn_kb threshold (15KB default)
   - Recommendation: The planner agent needs significant context. Consider raising the warning threshold for the planner specifically, or accept the warning. The planner is the most context-heavy role by design

## Sources

### Primary (HIGH confidence)
- Context7 `/ajv-validator/ajv` - Ajv v8 API, JSON Schema validation, standalone code generation, TypeScript support, custom keywords
- Context7 `/websites/json-schema_understanding-json-schema` - JSON Schema `$ref`, `$defs`, `allOf`, `oneOf` composition patterns, bundled schemas

### Secondary (MEDIUM confidence)
- [Ajv official documentation](https://ajv.js.org/) - Getting started, standalone validation, security considerations
- [JSON Schema specification](https://json-schema.org/) - Draft 2020-12 reference
- [toposort npm package](https://github.com/marcelklehr/toposort) - Reference implementation for topological sort algorithm (~75 lines)
- [Pactflow contract testing with JSON Schema](https://pactflow.io/blog/contract-testing-using-json-schemas-and-open-api-part-1/) - Contract testing patterns and best practices

### Tertiary (LOW confidence)
- [graphology-dag npm](https://www.npmjs.com/package/graphology-dag) - DAG library reference (not recommended for use -- too heavy)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Ajv is the established Node.js JSON Schema validator, well-documented in Context7 with 180+ snippets
- Architecture: HIGH - File structure patterns follow existing codebase conventions (`.cjs` modules, `node:test`, `.planning/` directory)
- Pitfalls: HIGH - JSON Schema and dependency graph pitfalls are well-documented across multiple sources
- DAG operations: HIGH - Topological sort and wave assignment are textbook algorithms with known implementations
- Contract test generation: MEDIUM - Auto-generated tests for behavioral expectations need implementation-time validation
- Ajv CJS import: LOW - Exact CommonJS import path needs verification at implementation time

**Research date:** 2026-03-04
**Valid until:** 2026-04-03 (30 days -- stable domain, no rapidly moving dependencies)
