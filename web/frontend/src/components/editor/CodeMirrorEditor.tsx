import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { vim } from "@replit/codemirror-vim";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeMirrorEditorHandle {
  getView: () => EditorView | null;
  insertText: (text: string) => void;
  wrapSelection: (before: string, after: string) => void;
  insertAtLineStart: (prefix: string) => void;
}

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  vimMode?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Everforest-compatible theme
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
// Component
// ---------------------------------------------------------------------------

export const CodeMirrorEditor = forwardRef<
  CodeMirrorEditorHandle,
  CodeMirrorEditorProps
>(function CodeMirrorEditor({ value, onChange, vimMode = false, className }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const vimCompartment = useRef(new Compartment());
  const programmaticRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Expose imperative handle for toolbar actions
  useImperativeHandle(ref, () => ({
    getView: () => viewRef.current,
    insertText: (text: string) => {
      const view = viewRef.current;
      if (!view) return;
      const { from } = view.state.selection.main;
      view.dispatch({
        changes: { from, to: from, insert: text },
        selection: { anchor: from + text.length },
      });
      view.focus();
    },
    wrapSelection: (before: string, after: string) => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const selected = view.state.doc.sliceString(from, to);
      const replacement = `${before}${selected || "text"}${after}`;
      view.dispatch({
        changes: { from, to, insert: replacement },
        selection: {
          anchor: from + before.length,
          head: from + before.length + (selected || "text").length,
        },
      });
      view.focus();
    },
    insertAtLineStart: (prefix: string) => {
      const view = viewRef.current;
      if (!view) return;
      const { from } = view.state.selection.main;
      const line = view.state.doc.lineAt(from);
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: prefix },
        selection: { anchor: from + prefix.length },
      });
      view.focus();
    },
  }));

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !programmaticRef.current) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        markdown(),
        editorTheme,
        darkHighlight,
        updateListener,
        vimCompartment.current.of(vimMode ? vim() : []),
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
    // Only run on mount -- value/vimMode changes handled by separate effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc === value) return;

    programmaticRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value,
      },
    });
    programmaticRef.current = false;
  }, [value]);

  // Toggle vim mode
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: vimCompartment.current.reconfigure(vimMode ? vim() : []),
    });
  }, [vimMode]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${className ?? ""}`}
      style={{ height: "100%" }}
    />
  );
});
