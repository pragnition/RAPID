import {
  useEffect,
  useRef,
  type ChangeEvent,
} from "react";
import { StructuredQuestion } from "@/components/primitives";
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
      const options = setSuggestions ?? [];
      const visibleRows = Math.min(Math.max(options.length, 2), 12);
      field = (
        <select
          value={strValue}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
          size={visibleRows}
          className={[
            "w-full bg-surface-1 border border-border rounded px-3 py-1.5",
            "text-sm text-fg outline-none focus:border-accent",
            "[&>option]:py-1.5 [&>option]:px-2 [&>option:checked]:bg-accent/20",
          ].join(" ")}
        >
          <option value="" disabled>
            Select a set...
          </option>
          {options.map((s, i) => (
            <option key={`${i}-${s}`} value={s}>
              {s}
            </option>
          ))}
        </select>
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
