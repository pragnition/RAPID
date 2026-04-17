# Wave 1 PLAN: Foundation -- Types, Hooks, Dependencies

## Objective

Establish the data layer for the code graph feature: TypeScript types matching the backend API, a React Query hook for polling `/code-graph` and fetching `/file` content on demand, and the npm dependencies needed for fcose layout and CodeMirror language support. No UI work in this wave -- downstream waves consume these artifacts.

## Tasks

### Task 1: Add CodeGraph and FileContent types to api.ts

**File:** `web/frontend/src/types/api.ts`
**Action:** Append new type definitions after the existing `CodebaseTree` section (after line 146).

Add the following types that match the backend response shapes exactly:

```
// Code Graph
CodeGraphNode { id: string; path: string; language: string; size: number; }
CodeGraphEdge { source: string; target: string; }
CodeGraph { nodes: CodeGraphNode[]; edges: CodeGraphEdge[]; total_files: number; total_edges: number; scanned_files: number; truncated: boolean; parse_errors: string[]; unresolved_imports: string[]; }

// File Content
FileContent { path: string; content: string; language: string | null; size: number; }
```

All interfaces must be exported. Place them in a new section with a `// Code Graph View` comment header, following the existing convention of comment-delimited sections.

**Verification:** `cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20` -- should show no errors related to these new types.

### Task 2: Create useCodeGraph hook

**File:** `web/frontend/src/hooks/useCodeGraph.ts` (new file)
**Action:** Create a new hook file with two exported hooks.

**Hook 1: `useCodeGraph(projectId: string | null)`**
- Uses `useQuery` from `@tanstack/react-query`
- Query key: `["code-graph", projectId]`
- Query function: `apiClient.get<CodeGraph>(\`/projects/${projectId}/code-graph\`)`
- `enabled: projectId !== null`
- `refetchInterval: 30_000` (30 second polling per CONTEXT.md decision)
- `staleTime: 15_000`
- Returns `useQuery` result typed as `UseQueryResult<CodeGraph, ApiError>`
- Import `ApiError` from `@/lib/apiClient`, `CodeGraph` from `@/types/api`

**Hook 2: `useFileContent(projectId: string | null, filePath: string | null)`**
- Uses `useQuery` from `@tanstack/react-query`
- Query key: `["file-content", projectId, filePath]`
- Query function: `apiClient.get<FileContent>(\`/projects/${projectId}/file?path=${encodeURIComponent(filePath!)}\`)`
- `enabled: projectId !== null && filePath !== null`
- `staleTime: 60_000` (file content rarely changes -- cache for 1 minute)
- No refetchInterval (on-demand only, not polled)
- Returns `UseQueryResult<FileContent, ApiError>`

Follow the exact patterns from `useViews.ts` for import style and structure.

**Verification:** `cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20` -- no type errors.

### Task 3: Install npm dependencies for fcose and CodeMirror languages

**File:** `web/frontend/package.json`
**Action:** Install the following packages:

```bash
cd ~/Projects/RAPID/web/frontend
npm install cytoscape-fcose @codemirror/lang-javascript @codemirror/lang-python @codemirror/lang-go @codemirror/lang-rust
npm install -D @types/cytoscape-fcose
```

After installation, verify `package.json` has these entries in the correct sections:
- `dependencies`: `cytoscape-fcose`, `@codemirror/lang-javascript`, `@codemirror/lang-python`, `@codemirror/lang-go`, `@codemirror/lang-rust`
- `devDependencies`: `@types/cytoscape-fcose`

Note: `@codemirror/lang-javascript` may already be an indirect dependency via `codemirror`, but it must be an explicit dependency since we import from it directly. `@codemirror/lang-markdown` is already explicit (used by CodeMirrorEditor).

**What NOT to do:**
- Do NOT install `@codemirror/lang-typescript` -- TypeScript support is provided by `@codemirror/lang-javascript` via `javascript({ typescript: true })`.
- Do NOT modify `package-lock.json` manually -- `npm install` handles it.

**Verification:** `cd ~/Projects/RAPID/web/frontend && node -e "require('cytoscape-fcose'); console.log('fcose OK')" && node -e "require('@codemirror/lang-javascript'); console.log('lang-js OK')"` -- both print OK.

## Success Criteria

1. `CodeGraph`, `CodeGraphNode`, `CodeGraphEdge`, and `FileContent` types exported from `api.ts`
2. `useCodeGraph` and `useFileContent` hooks exported from `useCodeGraph.ts`
3. All new npm packages installed and listed in `package.json`
4. `npx tsc --noEmit` passes with no new errors
5. No existing functionality broken -- all existing types and hooks untouched
