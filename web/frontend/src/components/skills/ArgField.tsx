import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { SearchInput, StructuredQuestion } from "@/components/primitives";
import type { SkillArg, PreconditionBlocker } from "@/types/skills";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ArgFieldProps {
  arg: SkillArg;
  value: unknown;
  onChange: (v: unknown) => void;
  blocker?: PreconditionBlocker;
  setSuggestions?: string[];
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Auto-growing textarea mirroring the Composer primitive's resize behaviour. */
function MultiLineInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "22px";
    const next = Math.min(ta.scrollHeight, 200);
    ta.style.height = `${Math.max(22, next)}px`;
  }, [value]);

  return (
    <textarea
      ref={taRef}
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      rows={1}
      className={[
        "w-full bg-surface-1 border border-border rounded px-3 py-1.5",
        "text-sm font-mono text-fg placeholder:text-muted",
        "outline-none resize-none focus:border-accent",
      ].join(" ")}
      style={{ minHeight: 22, maxHeight: 200 }}
    />
  );
}

/** Simple absolutely-positioned dropdown for set-ref suggestions. */
function SuggestionPopover({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (v: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <ul className="absolute left-0 right-0 top-full mt-1 z-10 bg-surface-1 border border-border rounded shadow-lg max-h-48 overflow-y-auto">
      {suggestions.map((s) => (
        <li key={s}>
          <button
            type="button"
            onClick={() => onPick(s)}
            className="w-full text-left px-3 py-1.5 text-sm text-fg hover:bg-hover"
          >
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ArgField({
  arg,
  value,
  onChange,
  blocker,
  setSuggestions,
}: ArgFieldProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const strValue = typeof value === "string" ? value : (value != null ? String(value) : "");
  const isDefault = arg.default != null && value === arg.default;

  // ---- Render the appropriate control per arg type ----

  let field: React.ReactNode;

  switch (arg.type) {
    case "string": {
      field = (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={strValue}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            placeholder={arg.default != null ? String(arg.default) : undefined}
            className={[
              "flex-1 bg-surface-1 border border-border rounded px-3 py-1.5",
              "text-sm text-fg placeholder:text-muted outline-none focus:border-accent",
            ].join(" ")}
          />
          {isDefault && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted uppercase tracking-wider shrink-0">
              default
            </span>
          )}
        </div>
      );
      break;
    }

    case "multi-line": {
      field = <MultiLineInput value={strValue} onChange={(v) => onChange(v)} />;
      break;
    }

    case "bool": {
      const boolStr = value === true || value === "true" ? "true" : "false";
      field = (
        <StructuredQuestion
          title={arg.name}
          label=""
          options={[
            { value: "true" as const, label: "Yes" },
            { value: "false" as const, label: "No" },
          ]}
          value={boolStr as "true" | "false"}
          onChange={(v) => onChange(v === "true")}
          className="p-0 border-0 bg-transparent"
        />
      );
      break;
    }

    case "choice": {
      const choices = arg.choices ?? [];
      field = (
        <StructuredQuestion
          title={arg.name}
          label=""
          options={choices.map((c) => ({ value: c, label: c }))}
          value={typeof value === "string" ? value : undefined}
          onChange={(v) => onChange(v)}
          className="p-0 border-0 bg-transparent"
        />
      );
      break;
    }

    case "set-ref": {
      const suggestions = setSuggestions ?? [];
      const filtered = strValue
        ? suggestions.filter((s) =>
            s.toLowerCase().includes(strValue.toLowerCase()),
          )
        : suggestions;

      field = (
        <div className="relative">
          <SearchInput
            value={strValue}
            onChange={(v) => {
              onChange(v);
              setShowSuggestions(true);
            }}
            placeholder="e.g. my-set-name"
            aria-label={arg.name}
            className="w-full"
          />
          {showSuggestions && filtered.length > 0 && (
            <SuggestionPopover
              suggestions={filtered}
              onPick={(v) => {
                onChange(v);
                setShowSuggestions(false);
              }}
            />
          )}
        </div>
      );
      break;
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-fg">
        {arg.name}
        {arg.required && <span className="text-error ml-0.5">*</span>}
      </label>
      {field}
      {arg.description && (
        <p className="text-xs text-muted">{arg.description}</p>
      )}
      {blocker && (
        <p className="text-xs text-error/80">{blocker.message}</p>
      )}
    </div>
  );
}
