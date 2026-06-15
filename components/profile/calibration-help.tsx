"use client";

import { useState } from "react";
import { ChevronDown, Gauge } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Pannello collassabile "Come funziona la calibrazione" (M7) — stesso stile di
 * HowToRead. Spiega in linguaggio semplice il modello a 3 livelli.
 */
export function CalibrationHelp() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50/60 text-sky-950">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Gauge className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1">Come funziona la calibrazione</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <p className="px-4 pb-4 text-sm leading-relaxed text-sky-900">
          La stima analizza le tue uscite MTB passate e impara la tua velocità
          reale su salite, discese e tratti pianeggianti. Più uscite MTB hai su
          Intervals.icu, più la stima è accurata. Finché non ci sono abbastanza
          dati tuoi, usiamo valori medi MTB (archetipo) ancorati a una gara
          reale; man mano che accumuli uscite, la stima diventa personale.
        </p>
      )}
    </section>
  );
}
