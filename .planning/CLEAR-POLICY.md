# CLEAR Policy -- Footer Inclusion Rules

All lifecycle skills display a standardized footer at completion with a `/clear` reminder, next command suggestion, and optional progress breadcrumb. The footer is produced by `renderFooter()` in `src/lib/display.cjs` and invoked via `node "${RAPID_TOOLS}" display footer`.

## Skills With Footer

| Skill | Footer | Next Command Pattern | Notes |
|-------|--------|---------------------|-------|
| init | Yes | `/rapid:start-set 1` | First lifecycle step; suggests starting first set |
| start-set | Yes | `/rapid:discuss-set {setIndex}` | Pipeline progression |
| discuss-set | Yes | `/rapid:plan-set {setIndex}` | Pipeline progression |
| plan-set | Yes | `/rapid:execute-set {setIndex}` | Pipeline progression; `--gaps` variant exists |
| execute-set | Yes | `/rapid:review {setIndex}` | Pipeline progression; conditional on gap status |
| review | Yes | `/rapid:unit-test {setIndex}` | Scoping step before test stages |
| merge | Yes | `/rapid:cleanup` or `/rapid:new-version` | Terminal pipeline step; multiple next options |
| new-version | Yes | `/rapid:start-set 1` | Starts new milestone cycle |
| add-set | Yes | `/rapid:start-set {setIndex}` | Ad-hoc set addition |
| scaffold | Yes | `/rapid:start-set` | Foundation generation |
| audit-version | Yes | `/rapid:new-version` or `/rapid:add-set` | Milestone audit |
| quick | Yes | `/rapid:status` | Ad-hoc task |
| branding | Yes | `/rapid:status` | Artifact generation |
| documentation | Yes | `/rapid:status` | Artifact generation |
| unit-test | Yes | `/rapid:bug-hunt {setIndex}` | Review sub-pipeline |
| bug-hunt | Yes | `/rapid:uat {setIndex}` | Review sub-pipeline |
| uat | Yes | `/rapid:review summary {setIndex}` | Review sub-pipeline |
| bug-fix | Yes | `/rapid:status` | Standalone fix |

## Skills Without Footer

| Skill | Footer | Notes |
|-------|--------|-------|
| help | No | Informational only, no artifacts |
| install | No | One-time setup, not a workflow step |
| status | No | Read-only dashboard |
| cleanup | No | Maintenance utility |
| pause | No | State management utility |
| resume | No | State management utility |
| assumptions | No | Research utility |
| context | No | Research utility |
| migrate | No | One-time migration |
| register-web | No | One-time registration |

## Rationale

Footer is shown by skills that generate artifacts or consume significant context. Informational, setup, and maintenance skills that produce no artifacts and consume minimal context are excluded.
