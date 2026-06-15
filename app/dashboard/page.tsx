import { redirect } from "next/navigation";

import { SyncButton } from "@/components/dashboard/sync-button";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import type { MirrorData } from "@/lib/intervals/sync";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * Dashboard readiness (Milestone 2, punto 4).
 *
 * Server Component: legge l'ULTIMO snapshot da athlete_metrics_snapshots
 * (via RLS, solo righe proprie) e mostra readiness, wellness e attività.
 * Ogni numero mostrato proviene dal mirror salvato — la pagina non chiama
 * mai Intervals direttamente e non calcola nulla: presenta.
 */

// Stili semaforici readiness derivati dai token del design system:
// barra laterale 3px del colore di stato + bordo semitrasparente, su bg-surface.
const DECISION_STYLES: Record<
  MirrorData["readiness_today"]["decision"],
  { label: string; text: string; border: string; bar: string }
> = {
  GO: {
    label: "GO",
    text: "text-ready-go",
    border: "border-ready-go-border",
    bar: "border-l-ready-go",
  },
  MODIFY: {
    label: "MODIFY",
    text: "text-ready-modify",
    border: "border-ready-modify-border",
    bar: "border-l-ready-modify",
  },
  SKIP: {
    label: "SKIP",
    text: "text-ready-skip",
    border: "border-ready-skip-border",
    bar: "border-l-ready-skip",
  },
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
        className="cursor-help text-muted"
      >
        —
      </span>
    );
  }
  return <span>{value.toFixed(decimals)}</span>;
}

/** Cella metrica del design system: label uppercase muted + valore grande. */
function MetricCell({
  label,
  accent = false,
  children,
}: {
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[11px] bg-surface-2 p-[0.9rem]">
      <dt className="text-[11px] uppercase tracking-[0.06em] text-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-[22px] font-medium",
          accent ? "text-amber" : "text-foreground"
        )}
      >
        {children}
      </dd>
    </div>
  );
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
    <AppShell>
        {/* Intro pagina */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Ciao {name}
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Connesso a Intervals.icu · qualità dati{" "}
              <span className="font-medium text-amber">
                {snapshot?.data_quality_level ?? "—"}
              </span>
              /4 ·{" "}
              <a
                href="/settings/profile"
                className="text-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                modifica profilo
              </a>
            </p>
          </div>
          <SyncButton lastFetchedAt={mirror?.fetched_at ?? null} />
        </div>

        {/* Banner gate Strava (PRD §11) — stato funzionale, semaforico giallo */}
        {mirror?.data_quality_warning === "strava_source_detected" && (
          <div className="rounded-2xl border border-l-[3px] border-ready-modify-border border-l-ready-modify bg-surface p-4 text-sm text-secondary">
            I tuoi dati arrivano via Strava — alcuni valori potrebbero essere
            incompleti. Collega il device direttamente a Intervals.icu per dati
            completi.
          </div>
        )}

        {!mirror && (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            Nessun dato ancora: premi «Aggiorna dati» per la prima
            sincronizzazione.
          </div>
        )}

        {/* Card "Oggi" — readiness */}
        {readiness && (
          <section
            className={cn(
              "rounded-2xl border border-l-[3px] bg-surface p-6",
              DECISION_STYLES[readiness.decision].border,
              DECISION_STYLES[readiness.decision].bar
            )}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                Oggi
              </h2>
              <span className="text-xs text-muted">
                confidenza {CONFIDENCE_LABELS[readiness.confidence]}
              </span>
            </div>
            <p
              className={cn(
                "my-2 text-[42px] font-bold leading-none",
                DECISION_STYLES[readiness.decision].text
              )}
            >
              {DECISION_STYLES[readiness.decision].label}
            </p>
            {triggeredSignals.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-secondary">
                {triggeredSignals.map((signal) => (
                  <li key={signal.name}>{signal.detail}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-secondary">
                Nessun segnale critico nei dati di oggi.
              </p>
            )}
          </section>
        )}

        {/* Card metriche wellness */}
        {mirror && (
          <section className="rounded-2xl bg-surface p-6">
            <h2 className="mb-4 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Metriche di oggi
            </h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCell label="CTL">
                <MetricValue value={ctl} />
              </MetricCell>
              <MetricCell label="ATL">
                <MetricValue value={atl} />
              </MetricCell>
              <MetricCell label="TSB" accent>
                <MetricValue value={tsb} />
              </MetricCell>
              <MetricCell label="ACWR">
                <MetricValue value={acwr} decimals={2} />
              </MetricCell>
              <MetricCell label="HRV">
                <MetricValue value={wellnessToday?.hrv} decimals={0} />
              </MetricCell>
              <MetricCell label="RHR">
                <MetricValue value={wellnessToday?.restingHR} decimals={0} />
              </MetricCell>
            </dl>
          </section>
        )}

        {/* Ultime 5 attività */}
        {mirror && (
          <section className="rounded-2xl bg-surface p-6">
            <h2 className="mb-4 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Ultime attività
            </h2>
            {recentActivities.length === 0 ? (
              <p className="text-sm text-muted">
                Nessuna attività negli ultimi 90 giorni.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentActivities.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {activity.name ?? "Attività"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {activity.sport_type ?? activity.type ?? "—"} ·{" "}
                        {activity.start_date_local.slice(0, 10)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-amber">
                        {formatDuration(activity.moving_time)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
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
    </AppShell>
  );
}
