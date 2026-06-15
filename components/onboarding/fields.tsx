"use client";

import { cn } from "@/lib/utils";

/**
 * Input riutilizzabili per il dossier (onboarding + /settings/profile).
 * Stile coerente con il resto dell'app (bordi morbidi, input shadcn-like).
 */

// Input del design system: sfondo bg-surface, bordo 0.5px, raggio 9px,
// focus ring ambra sottile, placeholder faint.
const inputClass =
  "form-control w-full";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  type?: "text" | "number" | "date";
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={type === "number" ? "decimal" : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="form-control w-full p-3"
      />
    </Field>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  placeholder = "Non specificato",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Selezione multipla a "chip" (sport, giorni). */
export function ChipMultiSelect({
  label,
  values,
  options,
  onToggle,
  hint,
}: {
  label: string;
  values: string[];
  options: Array<{ value: string; label: string }>;
  onToggle: (value: string) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = values.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(o.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                active
                  ? "border-amber bg-amber text-amber-on"
                  : "border-border text-secondary hover:bg-surface-2"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

/** Tristate Sì / No (null = non risposto). */
export function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        {[
          { v: true, l: "Sì" },
          { v: false, l: "No" },
        ].map(({ v, l }) => (
          <button
            key={l}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "flex-1 rounded-[9px] border px-3 py-2 text-sm transition-colors",
              value === v
                ? "border-amber bg-amber text-amber-on"
                : "border-border text-secondary hover:bg-surface-2"
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </Field>
  );
}
