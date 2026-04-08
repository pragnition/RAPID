import { useRef, useEffect, useState } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { useFileContent } from "@/hooks/useCodeGraph";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileViewerPanelProps {
  projectId: string;
  filePath: string | null; // null = panel closed
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Everforest-compatible read-only theme (local copy -- do NOT import from CodeMirrorEditor)
// ---------------------------------------------------------------------------

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
  },
  ".cm-editor": {
    height: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
  },
  ".cm-content": {
    caretColor: "var(--color-accent)",
    padding: "8px 0",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--color-accent)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--color-hover) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--color-surface-1)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-surface-0)",
    color: "var(--color-muted)",
    border: "none",
    borderRight: "1px solid var(--color-border)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--color-surface-1)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--color-surface-1)",
    border: "none",
    color: "var(--color-muted)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--color-surface-1)",
    border: "1px solid var(--color-border)",
    color: "var(--color-fg)",
  },
});

const darkHighlight = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--color-surface-0)",
      color: "var(--color-fg)",
    },
  },
  { dark: true },
);

// ---------------------------------------------------------------------------
// Language loading
// ---------------------------------------------------------------------------

async function loadLanguageExtension(
  lang: string | null,
): Promise<ReturnType<typeof import("@codemirror/lang-javascript").javascript> | null> {
  if (!lang) return null;
  const lower = lang.toLowerCase();

  switch (lower) {
    case "typescript":
    case "tsx":
      return import("@codemirror/lang-javascript").then((m) =>
        m.javascript({ typescript: true, jsx: lower === "tsx" }),
      );
    case "javascript":
    case "jsx":
      return import("@codemirror/lang-javascript").then((m) =>
        m.javascript({ jsx: lower === "jsx" }),
      );
    case "python":
      return import("@codemirror/lang-python").then((m) => m.python());
    case "go":
      return import("@codemirror/lang-go").then((m) => m.go());
    case "rust":
      return import("@codemirror/lang-rust").then((m) => m.rust());
    case "markdown":
    case "md":
      return import("@codemirror/lang-markdown").then((m) => m.markdown());
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractFilename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function languageBadgeColor(lang: string | null): string {
  if (!lang) return "bg-surface-2 text-muted";
  const map: Record<string, string> = {
    typescript: "bg-blue-900/40 text-blue-300",
    tsx: "bg-blue-900/40 text-blue-300",
    javascript: "bg-yellow-900/40 text-yellow-300",
    jsx: "bg-yellow-900/40 text-yellow-300",
    python: "bg-blue-900/40 text-blue-300",
    go: "bg-cyan-900/40 text-cyan-300",
    rust: "bg-orange-900/40 text-orange-300",
    css: "bg-indigo-900/40 text-indigo-300",
    markdown: "bg-surface-2 text-muted",
    md: "bg-surface-2 text-muted",
  };
  return map[lang.toLowerCase()] || "bg-surface-2 text-muted";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileViewerPanel({
  projectId,
  filePath,
  onClose,
}: FileViewerPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const langCompartment = useRef(new Compartment());
  const [isLoading, setIsLoading] = useState(false);

  const fileContentQuery = useFileContent(
    projectId,
    filePath,
  );

  const fileContent = fileContentQuery.data;
  const isFetching = fileContentQuery.isFetching;

  // Initialize CodeMirror once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: "",
      extensions: [
        basicSetup,
        EditorState.readOnly.of(true),
        editorTheme,
        darkHighlight,
        langCompartment.current.of([]),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update editor content when file data arrives
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !fileContent) return;

    // Update content
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: fileContent.content,
      },
    });

    // Update language
    loadLanguageExtension(fileContent.language).then((langExt) => {
      if (!viewRef.current) return;
      viewRef.current.dispatch({
        effects: langCompartment.current.reconfigure(langExt ? [langExt] : []),
      });
    });
  }, [fileContent]);

  // Track loading transitions for opacity crossfade
  useEffect(() => {
    setIsLoading(isFetching);
  }, [isFetching]);

  if (filePath === null) return null;

  const filename = extractFilename(filePath);

  return (
    <div
      role="complementary"
      aria-label="File viewer"
      className="w-[35%] h-full bg-surface-0 border-l border-border flex flex-col transition-transform duration-200 translate-x-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="text-sm text-fg truncate"
            title={filePath}
          >
            {filename}
          </span>
          {fileContent?.language && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${languageBadgeColor(fileContent.language)}`}
            >
              {fileContent.language}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-muted hover:text-fg transition-colors shrink-0"
          aria-label="Close file viewer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Accessibility announcement */}
      <div aria-live="polite" className="sr-only">
        {fileContent ? `Viewing ${filename}` : ""}
      </div>

      {/* Editor area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading skeleton */}
        {isFetching && !fileContent && (
          <div className="absolute inset-0 bg-surface-0 animate-pulse z-10" />
        )}

        {/* Error state */}
        {fileContentQuery.isError && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-0 z-10">
            <p className="text-red-400 text-sm">Failed to load file content</p>
          </div>
        )}

        {/* CodeMirror container with opacity crossfade */}
        <div
          ref={containerRef}
          className="h-full transition-opacity duration-150"
          style={{ opacity: isLoading ? 0.5 : 1 }}
        />
      </div>
    </div>
  );
}
