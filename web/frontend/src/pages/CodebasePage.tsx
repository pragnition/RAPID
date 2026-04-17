import { useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useCodebaseTree } from "@/hooks/useViews";
import type { CodeFile, CodeSymbol } from "@/types/api";
import {
  PageHeader,
  SurfaceCard,
  StatCard,
  EmptyState,
} from "@/components/primitives";

const LANG_COLORS: Record<string, string> = {
  python: "bg-blue-500/20 text-blue-400",
  javascript: "bg-yellow-500/20 text-yellow-400",
  typescript: "bg-blue-500/20 text-blue-300",
  go: "bg-cyan-500/20 text-cyan-400",
  rust: "bg-orange-500/20 text-orange-400",
};

function LanguageBadge({ language }: { language: string }) {
  const colorClass = LANG_COLORS[language] ?? "bg-gray-500/20 text-gray-400";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}>
      {language}
    </span>
  );
}

function kindIcon(kind: string): string {
  switch (kind) {
    case "function":
      return "fn";
    case "class":
      return "C";
    case "method":
      return "m";
    case "module":
      return "M";
    default:
      return "\u2022";
  }
}

function SymbolItem({ symbol, depth }: { symbol: CodeSymbol; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = symbol.children.length > 0;
  const indent = depth * 16;

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-2 py-0.5 w-full text-left hover:bg-surface-2/50 rounded px-1 text-sm"
        style={{ paddingLeft: `${indent + 4}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren && (
          <span className="text-muted text-xs w-3">{expanded ? "\u25BC" : "\u25B6"}</span>
        )}
        {!hasChildren && <span className="w-3" />}
        <span className="text-accent font-mono text-xs w-5 text-center shrink-0">
          {kindIcon(symbol.kind)}
        </span>
        <span className="text-fg">{symbol.name}</span>
        <span className="text-muted text-xs ml-auto shrink-0">
          L{symbol.start_line}-{symbol.end_line}
        </span>
      </button>
      {expanded &&
        symbol.children.map((child, i) => (
          <SymbolItem key={`${child.name}-${i}`} symbol={child} depth={depth + 1} />
        ))}
    </div>
  );
}

function FileTreeItem({ file }: { file: CodeFile }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        className="flex items-center gap-2 px-4 py-2.5 w-full text-left hover:bg-surface-2/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-muted text-xs w-4">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <span className="text-fg font-mono text-sm truncate flex-1">{file.path}</span>
        <LanguageBadge language={file.language} />
        <span className="text-muted text-xs shrink-0">
          {file.symbols.length} symbol{file.symbols.length !== 1 ? "s" : ""}
        </span>
      </button>
      {expanded && (
        <div className="pb-2">
          {file.symbols.length === 0 ? (
            <p className="text-muted text-xs px-8 py-1">No symbols found</p>
          ) : (
            file.symbols.map((sym, i) => (
              <SymbolItem key={`${sym.name}-${i}`} symbol={sym} depth={0} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function CodebasePage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { data, isLoading, isError, error } = useCodebaseTree(activeProjectId);
  const [showErrors, setShowErrors] = useState(false);

  if (!activeProjectId) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Codebase"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Codebase" }]}
        />
        <EmptyState
          title="No project selected"
          description="Select a project from the sidebar to view codebase structure."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Codebase"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Codebase" }]}
        />
        <div className="space-y-4">
          <div className="h-12 bg-surface-1 rounded-lg animate-pulse" />
          <div className="h-64 bg-surface-1 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const is404 = error && "status" in error && error.status === 404;
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Codebase"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Codebase" }]}
        />
        <EmptyState
          title={is404 ? "No codebase data" : "Failed to load codebase"}
          description={
            is404
              ? "No codebase data available for this project."
              : "Check that the backend is running and try again."
          }
        />
      </div>
    );
  }

  if (data.files.length === 0 && data.parse_errors.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Codebase"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Codebase" }]}
        />
        <EmptyState
          title="No supported source files found"
          description="Add supported source files to see the codebase tree."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Codebase"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Codebase" }]}
        actions={
          <div className="flex items-center gap-2">
            {data.languages.map((lang) => (
              <LanguageBadge key={lang} language={lang} />
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
        {/* Left rail: summary stats */}
        <SurfaceCard elevation={1} className="p-4 space-y-3">
          <StatCard label="Files Parsed" value={data.total_files} tone="accent" />
          <StatCard label="Languages" value={data.languages.length} tone="info" />
          <StatCard
            label="Parse Errors"
            value={data.parse_errors.length}
            tone={data.parse_errors.length > 0 ? "warning" : "accent"}
          />
        </SurfaceCard>

        {/* Right: file tree */}
        <SurfaceCard elevation={1} className="p-0 overflow-hidden">
          {data.files.map((file) => (
            <FileTreeItem key={file.path} file={file} />
          ))}
        </SurfaceCard>
      </div>

      {data.parse_errors.length > 0 && (
        <SurfaceCard elevation={1}>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-3 w-full text-left"
            onClick={() => setShowErrors(!showErrors)}
          >
            <span className="text-muted text-xs">
              {showErrors ? "\u25BC" : "\u25B6"}
            </span>
            <span className="text-error font-medium text-sm">
              Parse Errors ({data.parse_errors.length})
            </span>
          </button>
          {showErrors && (
            <div className="px-4 pb-3 space-y-1">
              {data.parse_errors.map((err, i) => (
                <div
                  key={i}
                  className="px-3 py-1.5 rounded bg-error/10 text-error text-sm font-mono"
                >
                  {err}
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      )}
    </div>
  );
}
