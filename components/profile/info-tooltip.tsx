"use client";

import { useEffect, useRef, useState } from "react";

import { GLOSSARY } from "@/lib/profile/glossary";
import { cn } from "@/lib/utils";

/**
 * Icona "?" accanto a un termine della scheda atleta. Al passaggio del mouse
 * (desktop) o al tap (mobile) mostra il testo del glossario.
 *
 * Implementazione autonoma (niente dipendenze nuove): hover via mouse events,
 * tap via click, chiusura con click-fuori o Esc. Il testo arriva da
 * lib/profile/glossary.ts (trascritto esatto dal file docs) tramite `term`.
 */
export function InfoTooltip({
  term,
  className,
}: {
  term: keyof typeof GLOSSARY | string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const text = GLOSSARY[term];

  // Chiudi su click esterno e su Esc (utile per il tap su mobile).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!text) return null; // termine non in glossario: non mostrare nulla

  return (
    <span
      ref={wrapperRef}
      className={cn("relative inline-flex align-middle", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Spiegazione: ${term}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-semibold leading-none text-muted transition-colors hover:border-amber hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-[11px] border border-border bg-surface p-3 text-left text-xs font-normal leading-relaxed text-secondary"
        >
          {text}
        </span>
      )}
    </span>
  );
}
