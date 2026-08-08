"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { MEMORY_TYPES } from "@/lib/ai/coach-memory";

/**
 * "Gli appunti del coach" — le note che l'LLM ha scritto su di te, con la
 * possibilità di toglierle.
 *
 * Prima non esistevano schermate: le note entravano in ogni prompt e non c'era
 * modo né di vederle né di cancellarle. Un atleta che svuotava un campo del
 * dossier continuava a sentirsi nominare quel problema, senza capire da dove
 * arrivasse.
 *
 * Le note di tipo non più supportato (`osservazione`, scritte prima del
 * 2026-08-05) si vedono ancora ed etichettate: non entrano più nei prompt, ma
 * far sparire dei dati salvati senza dirlo sarebbe peggio che mostrarli.
 */

export interface CoachMemoryItem {
  id: string;
  memory_type: string;
  nota: string;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  preferenza: "Preferenza",
  infortunio: "Infortunio",
  traguardo: "Traguardo",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString("it-IT", { month: "short" })} ${d.getFullYear()}`;
}

export function CoachMemoryList({ items }: { items: CoachMemoryItem[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    setError(null);
    const res = await fetch(`/api/settings/memory?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => null);
    setDeleting(null);
    if (!res || !res.ok) {
      setError("Cancellazione fallita, riprova");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <p className="text-[13px] text-secondary">
        Note che il coach ha scritto su di te leggendo i tuoi dati. Entrano in
        ogni suo commento: se una non è più vera, toglila da qui.
      </p>

      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-faint">
          Nessuna nota per ora. Il coach ne scrive quando nota qualcosa di
          durevole (una preferenza, un infortunio, un obiettivo).
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const legacy = !(MEMORY_TYPES as readonly string[]).includes(
              item.memory_type
            );
            return (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.1em] text-faint">
                    {TYPE_LABEL[item.memory_type] ?? item.memory_type}
                    {legacy && " · non più usata"} · {formatDate(item.created_at)}
                  </div>
                  <p
                    className={`mt-0.5 text-[13px] leading-snug ${legacy ? "text-faint" : "text-secondary"}`}
                  >
                    {item.nota}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(item.id)}
                  disabled={deleting === item.id}
                  aria-label={`Elimina la nota: ${item.nota}`}
                  className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[12px] text-ready-skip transition-colors hover:bg-ready-skip/10 disabled:opacity-40"
                >
                  {deleting === item.id ? "…" : "Elimina"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mt-2 text-sm text-ready-skip">{error}</p>}
    </div>
  );
}
