"use client";

import { ChevronRight } from "lucide-react";

/**
 * Riga di accordion riutilizzabile — stesso markup/stile della lista dossier
 * in dossier-form.tsx, estratto perché ora la usano anche le voci "esterne"
 * (recupero, gare, taccuino, filosofia, chiave Groq): una sola lista invece
 * di card di vetro sparse una sotto l'altra.
 */
export function AccordionRow({
  icon: Icon,
  label,
  isExpanded,
  onToggle,
  isFirst = false,
  children,
}: {
  icon: React.ElementType;
  label: string;
  isExpanded: boolean;
  onToggle: () => void;
  isFirst?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={isFirst ? "" : "border-t"} style={{ borderColor: "var(--glass-border)" }}>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
        <ChevronRight
          className="h-4 w-4 text-faint transition-transform duration-200"
          style={{ transform: isExpanded ? "rotate(90deg)" : undefined }}
          aria-hidden
        />
      </button>

      <div className={`grid transition-all duration-200 ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--glass-border)" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
