"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { RefreshControl } from "@/components/dashboard/refresh-control";

/**
 * Wrapper del pulsante manuale "Aggiorna dati" che concatena il lavoro
 * post-sync. Nessun sync automatico al mount: l'utente avvia tutto premendo
 * il pulsante di RefreshControl.
 *
 * Catena dopo un sync manuale riuscito:
 *   1. RefreshControl fa il sync e riporta l'esito via onSyncDone.
 *   2. generate piano → legge changed_count
 *   3. build profilo
 *   4. un solo router.refresh() finale.
 *
 * Anti-loop: ref guard `chainStarted` per evitare che StrictMode/re-render
 * riavviino la catena più volte per lo stesso sync.
 */
export function AutoUpdateOrchestrator({
  lastFetchedAt,
  initialStatus,
  hasMirror,
}: {
  lastFetchedAt: string | null;
  initialStatus: "fresh" | "stale";
  hasMirror: boolean;
}) {
  const router = useRouter();
  const chainStarted = useRef(false);
  const [changedCount, setChangedCount] = useState(0);

  /** POST a una route della catena. Errori non propagati (la catena prosegue). */
  async function step(
    path: string
  ): Promise<{ ok: boolean; body: Record<string, unknown> | null }> {
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      return { ok: res.ok, body };
    } catch {
      return { ok: false, body: null };
    }
  }

  const onSyncDone = useCallback(
    (syncOk: boolean) => {
      // Ref guard: evita che la catena parta due volte per lo stesso sync
      // (es. doppio evento), ma si riarma subito dopo per permettere un
      // nuovo giro al prossimo click su "Aggiorna dati".
      if (chainStarted.current) return;
      chainStarted.current = true;

      // Sync fallito → banner errore già mostrato da RefreshControl, niente catena.
      if (!syncOk) {
        chainStarted.current = false;
        return;
      }

      void (async () => {
        // §2 — rigenera piano e leggi changed_count.
        const gen = await step("/api/planner/generate");
        if (gen.ok && typeof gen.body?.changed_count === "number") {
          setChangedCount(gen.body.changed_count as number);
        }

        // §3 — build profilo (deterministico, ricostruisce il profilo).
        await step("/api/profile/build");

        chainStarted.current = false;
        // Un unico refresh finale: rilegge metriche + piano aggiornati.
        router.refresh();
      })();
    },
    [router]
  );

  return (
    <div>
      <RefreshControl
        lastFetchedAt={lastFetchedAt}
        initialStatus={initialStatus}
        onSyncDone={onSyncDone}
      />

      {changedCount > 0 && (
        <div className="mt-3 rounded-xl border border-l-[3px] border-ready-modify-border border-l-ready-modify bg-surface px-4 py-3 text-sm text-secondary">
          Il piano è cambiato: {changedCount} sedut
          {changedCount === 1 ? "a" : "e"} modificat
          {changedCount === 1 ? "a" : "e"} — rivedi in Piano e invia a Intervals.
        </div>
      )}
    </div>
  );
}
