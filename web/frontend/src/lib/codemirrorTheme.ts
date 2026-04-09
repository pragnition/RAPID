/**
 * Shared CodeMirror syntax highlight theme.
 *
 * Maps Lezer highlight tags to CSS custom properties (--th-*) so the
 * highlight colours follow the active application theme automatically.
 *
 * Usage:
 *   import { themeHighlighting } from '@/lib/codemirrorTheme';
 *   const state = EditorState.create({ extensions: [themeHighlighting, ...] });
 */

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/**
 * HighlightStyle definition mapping Lezer tags to theme CSS variables.
 * The browser resolves `var(--th-*)` at render time, so the same style
 * works for both light and dark themes without re-creation.
 */
export const themeHighlightStyle: HighlightStyle = HighlightStyle.define([
  // -- Keywords --
  { tag: tags.keyword, color: "var(--th-highlight)" },
  { tag: tags.controlKeyword, color: "var(--th-error)" },
  { tag: tags.definitionKeyword, color: "var(--th-highlight)" },

  // -- Comments --
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: "var(--th-muted)",
    fontStyle: "italic",
  },

  // -- Strings --
  {
    tag: [tags.string, tags.special(tags.string)],
    color: "var(--th-accent)",
  },

  // -- Literals --
  { tag: [tags.number, tags.bool], color: "var(--th-orange)" },
  { tag: tags.null, color: "var(--th-orange)" },
  { tag: tags.regexp, color: "var(--th-orange)" },

  // -- Variables --
  { tag: tags.variableName, color: "var(--th-fg)" },
  { tag: tags.definition(tags.variableName), color: "var(--th-fg)" },

  // -- Functions --
  {
    tag: tags.function(tags.variableName),
    color: "var(--th-link)",
  },

  // -- Types & Classes --
  { tag: [tags.typeName, tags.className], color: "var(--th-warning)" },

  // -- Properties --
  { tag: tags.propertyName, color: "var(--th-info)" },
  { tag: tags.definition(tags.propertyName), color: "var(--th-info)" },

  // -- Operators & Punctuation --
  { tag: tags.operator, color: "var(--th-fg-dim)" },
  { tag: tags.punctuation, color: "var(--th-muted)" },

  // -- Meta (decorators, annotations) --
  { tag: tags.meta, color: "var(--th-fg-dim)" },
]);

/**
 * Ready-to-use CodeMirror extension that applies the highlight style.
 * Add this to an EditorState's extensions array.
 */
export const themeHighlighting: Extension = syntaxHighlighting(
  themeHighlightStyle,
);
