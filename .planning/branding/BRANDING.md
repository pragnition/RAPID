# Project Branding Guidelines

<identity>
## Project Identity

RAPID is a technical-first developer tool for orchestrating parallel, isolated development workflows. The project presents itself as precise, specification-grade infrastructure — comparable to protocol documentation or compiler references. Communication conveys exactness, authority, and deep domain knowledge without unnecessary embellishment.
</identity>

<tone>
## Tone & Voice

- **Perspective:** Third-person. The system performs actions; the agent executes tasks. Avoid "you", "we", "I", and "let's".
- **Formality:** Formal. Declarative statements. No colloquialisms or casual phrasing.
- **Sentence structure:** Direct and unambiguous. Each sentence conveys one fact or instruction.
- **Example (correct):** "The merge subsystem detects five levels of conflict: textual, structural, dependency, API, and semantic."
- **Example (incorrect):** "We check for five kinds of conflicts when merging your code."
</tone>

<terminology>
## Terminology & Naming

### Code Conventions
- Variables and functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Boolean accessors: `is*`, `has*`, `can*` prefixes
- Source files: `{name}.cjs` (CommonJS)
- Test files: `{name}.test.cjs` (co-located, `node:test`)
- Planning documents: UPPERCASE with hyphens (`STATE.json`, `DEFINITION.md`, `CONTRACT.json`)

### Domain Terms

| Preferred Term | Instead Of | Context |
|---------------|-----------|---------|
| Set | task, module, feature | Core parallelizable unit of work with isolated worktree |
| Wave | batch, phase, stage | Parallel execution group determined by dependency depth |
| Job | task, step, action | Granular implementation item within a wave |
| Milestone | release, sprint, iteration | Collection of related sets on the project roadmap |
| Contract | interface, schema, spec | JSON Schema interface definition (`CONTRACT.json`) |
| DAG | dependency tree, graph | Directed Acyclic Graph of set precedence |
| Worktree | branch, workspace, sandbox | Isolated git worktree per set |
| Phase | step, stage | Workflow stage: `discuss`, `plan`, `execute` |
| Concern | category, group | Thematic file grouping during review scoping |
| Checkpoint | save point, snapshot | Execution pause point with resumption context |

### Status Lifecycle
- Sets: `pending` -> `discussed` -> `planned` -> `executed` -> `complete` -> `merged`
- Waves: `pending` -> `executing` -> `complete`
- Jobs: `pending` -> `executing` -> `complete`
</terminology>

<output>
## Output Style

- **Documentation:** Detailed with examples. Each non-trivial concept receives a code sample or usage example demonstrating correct application.
- **Code comments:** Explain non-obvious behavior, architectural decisions, and edge cases. Include inline examples where a function signature alone is insufficient.
- **Commit messages:** `type(scope): description` format. Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`.
- **Planning artifacts:** Structured markdown with explicit section headers, tables for tabular data, and numbered lists for sequential procedures.

### Example Documentation Pattern
```markdown
## merge-state.cjs

Tracks per-set merge progress through 5-level conflict detection.

### Usage
const state = readMergeState(planningDir);
state.sets['auth'].detection.textual; // 'clean' | 'conflict'

### Detection Levels
| Level | Type | Description |
|-------|------|-------------|
| L1 | Textual | Git-native line-level conflicts |
| L2 | Structural | AST-level incompatible changes |
```
</output>

<anti-patterns>
## Anti-Patterns (Do NOT)

- Do not use emojis in documentation, comments, commit messages, or agent output
- Do not use marketing language, superlatives, or promotional tone ("blazing fast", "revolutionary", "game-changing")
- Do not use filler words: "basically", "simply", "just", "very", "really", "actually", "literally"
- Do not use second-person ("you") or first-person ("we", "I") in documentation or comments
- Do not use colloquialisms, slang, or casual abbreviations ("gonna", "wanna", "LGTM" in prose)
- Do not substitute domain terms with generic alternatives (e.g., "task" instead of "job", "module" instead of "set")
- Do not omit examples when documenting non-trivial interfaces or behaviors
</anti-patterns>
