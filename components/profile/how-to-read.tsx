"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";

import { HOW_TO_READ } from "@/lib/profile/glossary";
import { cn } from "@/lib/utils";

/**
 * Box "Come leggere questa scheda" (sezione 2 del file docs): riquadro
 * collassabile in cima a /profile. Aperto di default la prima volta; la
 * scelta dell'utente viene ricordata in localStorage per le visite successive.
 */
const STORAGE_KEY = "coach-ia:how-to-read-open";

export function HowToRead() {
  // Aperto di default; al mount sincronizzo con la preferenza salvata (se c'è).
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved !== null) setOpen(saved === "1");
  }, []);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50/60 text-sky-950">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1">{HOW_TO_READ.title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <p className="px-4 pb-4 text-sm leading-relaxed text-sky-900">
          {HOW_TO_READ.body}
        </p>
      )}
    </section>
  );
}
