import { redirect } from "next/navigation";

import { ReadinessHero } from "@/components/dashboard/readiness-hero";
import { SyncButton } from "@/components/dashboard/sync-button";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { MetricStrip } from "@/components/ui/metric-strip";
import { SectionHeader } from "@/components/ui/section-header";
import { Stat } from "@/components/ui/stat";
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

/** "—" con tooltip quando il dato manca (possibile fonte Strava, PRD §11). */
function MetricValue({
  value,
  decimals = 1,
  showSign = false,
}: {
  value: number | null | undefined;
  decimals?: number;
  showSign?: boolean;
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
  const formatted = value.toFixed(decimals);
  return <span>{showSign && value > 0 ? `+${formatted}` : formatted}</span>;
}

/** Secondi → "1h 23m" per la lista attività. */
function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

/** Data attività compatta, localizzata in italiano. */
function formatActivityDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
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
        .slice(0, 3)
    : [];

  return (
    <AppShell className="gap-10 py-10 sm:py-12">
      <PageHeader
        eyebrow="Il tuo stato"
        title={`Ciao ${name}`}
        description={
          <>
            Dati Intervals.icu aggiornati con qualità{" "}
            <span className="font-medium text-foreground">
              {snapshot?.data_quality_level ?? "—"}/4
            </span>
            .{" "}
            <a
              href="/settings/profile"
              className="text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Modifica profilo
            </a>
          </>
        }
        action={<SyncButton lastFetchedAt={mirror?.fetched_at ?? null} />}
      />

      {mirror?.data_quality_warning === "strava_source_detected" && (
        <div className="rounded-2xl border border-l-[3px] border-ready-modify-border border-l-ready-modify bg-surface px-5 py-4 text-sm text-secondary">
          I tuoi dati arrivano via Strava: alcuni valori potrebbero essere
          incompleti. Collega il device direttamente a Intervals.icu per dati
          completi.
        </div>
      )}

      {!mirror && (
        <div className="rounded-2xl border border-border bg-surface px-6 py-10 text-center">
          <p className="text-base font-medium text-foreground">
            Il tuo spazio dati è ancora vuoto.
          </p>
          <p className="mt-2 text-sm text-muted">
            Premi «Aggiorna dati» per avviare la prima sincronizzazione.
          </p>
        </div>
      )}

      {readiness && <ReadinessHero readiness={readiness} />}

      {mirror && (
        <section className="space-y-4">
          <SectionHeader
            label="Carico e recupero"
            title="Metriche di oggi"
          />
          <MetricStrip>
            <Stat label="CTL" value={<MetricValue value={ctl} />} />
            <Stat label="ATL" value={<MetricValue value={atl} />} />
            <Stat
              label="TSB"
              value={<MetricValue value={tsb} showSign />}
              accent
            />
            <Stat
              label="ACWR"
              value={<MetricValue value={acwr} decimals={2} />}
            />
            <Stat
              label="HRV"
              value={<MetricValue value={wellnessToday?.hrv} decimals={0} />}
            />
            <Stat
              label="RHR"
              value={
                <MetricValue value={wellnessToday?.restingHR} decimals={0} />
              }
            />
          </MetricStrip>
        </section>
      )}

      {mirror && (
        <section className="space-y-4">
          <SectionHeader
            label="Storico recente"
            title="Ultime attività"
            description="Le tre sessioni più recenti sincronizzate da Intervals.icu."
          />
          {recentActivities.length === 0 ? (
            <p className="border-t border-border py-6 text-sm text-muted">
              Nessuna attività negli ultimi 90 giorni.
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {recentActivities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex min-h-[72px] items-center justify-between gap-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {activity.name ?? "Attività"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {activity.sport_type ?? activity.type ?? "—"} ·{" "}
                      {formatActivityDate(activity.start_date_local)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[15px] font-medium text-foreground">
                      {formatDuration(activity.moving_time)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
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

      <footer className="border-t border-border pt-5">
        <p className="text-xs leading-5 text-faint">
          Questa operazione rimuove solo l&apos;accesso ai dati Intervals.icu.
          Il tuo account Coach IA resta attivo.
        </p>
        <form
          action="/api/auth/intervals/disconnect"
          method="post"
          className="mt-1"
        >
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="px-0 text-xs text-muted hover:bg-transparent hover:text-ready-skip"
          >
            Scollega Intervals.icu
          </Button>
        </form>
      </footer>
    </AppShell>
  );
}
