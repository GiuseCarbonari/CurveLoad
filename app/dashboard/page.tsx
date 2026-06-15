import { redirect } from "next/navigation";

import { SyncButton } from "@/components/dashboard/sync-button";
import { Button } from "@/components/ui/button";
import type { MirrorData } from "@/lib/intervals/sync";
import { createClient } from "@/lib/supabase/server";

/**
 * Dashboard readiness (Milestone 2, punto 4).
 *
 * Server Component: legge l'ULTIMO snapshot da athlete_metrics_snapshots
 * (via RLS, solo righe proprie) e mostra readiness, wellness e attività.
 * Ogni numero mostrato proviene dal mirror salvato — la pagina non chiama
 * mai Intervals direttamente e non calcola nulla: presenta.
 */

const DECISION_STYLES: Record<
  MirrorData["readiness_today"]["decision"],
  { label: string; classes: string }
> = {
  GO: { label: "GO", classes: "border-green-500 bg-green-50 text-green-900" },
  MODIFY: {
    label: "MODIFY",
    classes: "border-yellow-500 bg-yellow-50 text-yellow-900",
  },
  SKIP: { label: "SKIP", classes: "border-red-500 bg-red-50 text-red-900" },
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "alta",
  medium: "media",
  low: "bassa",
};

/** "—" con tooltip quando il dato manca (possibile fonte Strava, PRD §11). */
function MetricValue({
  value,
  decimals = 1,
}: {
  value: number | null | undefined;
  decimals?: number;
}) {
  if (value == null) {
    return (
      <span
        title="Dato non disponibile (possibile fonte Strava)"
        className="cursor-help text-muted-foreground"
      >
        —
      </span>
    );
  }
  return <span>{value.toFixed(decimals)}</span>;
}

/** Secondi → "1h 23m" per la lista attività. */
function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login"); // difesa in profondità oltre il middleware
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("intervals_athlete_name")
    .eq("id", user.id)
    .maybeSingle();
  const name = userRow?.intervals_athlete_name ?? "atleta";

  // Ultimo snapshot: la dashboard mostra sempre il sync più recente.
  const { data: snapshot } = await supabase
    .from("athlete_metrics_snapshots")
    .select("id, snapshot_date, mirror_data, data_quality_level, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const mirror = (snapshot?.mirror_data ?? null) as MirrorData | null;
  const readiness = mirror?.readiness_today ?? null;

  // Wellness di oggi = ultima riga della finestra 30g (ordinata per data).
  const wellnessToday = mirror?.wellness_30d.at(-1) ?? null;
  const ctl = wellnessToday?.ctl ?? null;
  const atl = wellnessToday?.atl ?? null;
  // TSB/ACWR: stesse semplici operazioni della readiness (lettura, non derivazione).
  const tsb = ctl != null && atl != null ? ctl - atl : null;
  const acwr = ctl != null && atl != null ? (ctl === 0 ? 0 : atl / ctl) : null;

  const recentActivities = mirror
    ? [...mirror.activities_90d]
        .sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))
        .slice(0, 5)
    : [];

  const triggeredSignals =
    readiness?.signals.filter(
      (s) => s.status === "amber" || s.status === "red"
    ) ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Ciao {name}, connesso a Intervals.icu ✓
          </h1>
          <p className="text-sm text-muted-foreground">
            Livello qualità dati: {snapshot?.data_quality_level ?? "—"} / 4 ·{" "}
            <a href="/profile" className="underline">
              scheda atleta
            </a>{" "}
            ·{" "}
            <a href="/plan" className="underline">
              piano settimanale
            </a>{" "}
            ·{" "}
            <a href="/settings/profile" className="underline">
              modifica profilo
            </a>
          </p>
        </div>
        <SyncButton lastFetchedAt={mirror?.fetched_at ?? null} />
      </div>

      {/* Banner gate Strava (PRD §11) */}
      {mirror?.data_quality_warning === "strava_source_detected" && (
        <div className="rounded-md border border-yellow-500 bg-yellow-50 p-4 text-sm text-yellow-900">
          I tuoi dati arrivano via Strava — alcuni valori potrebbero essere
          incompleti. Collega il device direttamente a Intervals.icu per dati
          completi.
        </div>
      )}

      {!mirror && (
        <div className="rounded-md border p-6 text-center text-muted-foreground">
          Nessun dato ancora: premi «Aggiorna dati» per la prima
          sincronizzazione.
        </div>
      )}

      {/* Card "Oggi" — readiness */}
      {readiness && (
        <section
          className={`rounded-lg border-2 p-6 ${DECISION_STYLES[readiness.decision].classes}`}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Oggi</h2>
            <span className="text-xs">
              confidenza {CONFIDENCE_LABELS[readiness.confidence]}
            </span>
          </div>
          <p className="my-2 text-4xl font-bold">
            {DECISION_STYLES[readiness.decision].label}
          </p>
          {triggeredSignals.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {triggeredSignals.map((signal) => (
                <li key={signal.name}>{signal.detail}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">Nessun segnale critico nei dati di oggi.</p>
          )}
        </section>
      )}

      {/* Card metriche wellness */}
      {mirror && (
        <section className="rounded-lg border p-6">
          <h2 className="mb-4 text-lg font-semibold">Metriche di oggi</h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase text-muted-foreground">CTL</dt>
              <dd className="text-2xl font-semibold">
                <MetricValue value={ctl} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">ATL</dt>
              <dd className="text-2xl font-semibold">
                <MetricValue value={atl} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">TSB</dt>
              <dd className="text-2xl font-semibold">
                <MetricValue value={tsb} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">ACWR</dt>
              <dd className="text-2xl font-semibold">
                <MetricValue value={acwr} decimals={2} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">HRV</dt>
              <dd className="text-2xl font-semibold">
                <MetricValue value={wellnessToday?.hrv} decimals={0} />
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">RHR</dt>
              <dd className="text-2xl font-semibold">
                <MetricValue value={wellnessToday?.restingHR} decimals={0} />
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* Ultime 5 attività */}
      {mirror && (
        <section className="rounded-lg border p-6">
          <h2 className="mb-4 text-lg font-semibold">Ultime attività</h2>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna attività negli ultimi 90 giorni.
            </p>
          ) : (
            <ul className="divide-y">
              {recentActivities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {activity.name ?? "Attività"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.sport_type ?? activity.type ?? "—"} ·{" "}
                      {activity.start_date_local.slice(0, 10)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p>{formatDuration(activity.moving_time)}</p>
                    <p className="text-xs text-muted-foreground">
                      TSS{" "}
                      {activity.icu_training_load != null
                        ? Math.round(activity.icu_training_load)
                        : "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Disconnessione (da Milestone 1) */}
      <form action="/api/auth/intervals/disconnect" method="post">
        <Button type="submit" variant="outline" size="sm">
          Disconnetti Intervals.icu
        </Button>
      </form>
    </main>
  );
}
