import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { GenerateWeekButton } from "@/components/plan/generate-week-button";
import { PushButton } from "@/components/plan/push-button";
import { RedistributeSection } from "@/components/plan/redistribute-section";
import type { BuiltSession } from "@/lib/planner/build-week";
import type { Phase } from "@/lib/planner/phase-detector";
import type { DayKey } from "@/lib/planner/session-selector";
import type { MirrorData } from "@/lib/intervals/sync";
import { createClient } from "@/lib/supabase/server";

/**
 * /plan — settimana di allenamento generata dal planner (M6, Section 11 B).
 *
 * Server Component: legge l'ultimo piano da weekly_plans (RLS, solo righe
 * proprie) e la readiness di oggi dall'ultimo snapshot. NON genera il piano e
 * non calcola nulla: presenta ciò che il planner ha già deciso. La generazione
 * avviene via POST /api/planner/generate (bottone "Genera settimana").
 */

export const dynamic = "force-dynamic";

const PHASE_BADGE: Record<Phase, { label: string; classes: string }> = {
  base: { label: "Base", classes: "border-border bg-surface-2 text-secondary" },
  build: { label: "Build", classes: "border-border bg-amber-dim text-amber" },
  peak: { label: "Peak", classes: "border-border bg-amber-dim text-amber" },
  taper: { label: "Taper", classes: "border-border bg-surface-2 text-secondary" },
  recovery: { label: "Recovery", classes: "border-border bg-surface-2 text-secondary" },
};

const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

interface PlanRow {
  week_start: string;
  phase: Phase;
  sessions: BuiltSession[];
  narrative: string | null;
  validation_metadata: {
    days_to_event?: number | null;
    hard_sessions?: number;
    hard_spacing_ok?: boolean;
    volume_hours_estimate?: number;
    phase_reason?: string;
  } | null;
  generated_at: string;
  pushed_at: string | null;
}

/** "13 giu 2026" da YYYY-MM-DD. */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

export default async function PlanPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: planRow } = await supabase
    .from("weekly_plans")
    .select("week_start, phase, sessions, narrative, validation_metadata, generated_at, pushed_at")
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const plan = (planRow ?? null) as PlanRow | null;

  const { data: connection } = await supabase
    .from("intervals_connections")
    .select("granted_scopes")
    .eq("user_id", user.id)
    .maybeSingle();
  const canWriteCalendar = (connection?.granted_scopes ?? "")
    .split(/[\s,]+/)
    .some((scope: string) => scope.trim().toUpperCase() === "CALENDAR:WRITE");

  // Readiness di oggi (per evidenziare il giorno corrente nella griglia).
  const { data: snapshot } = await supabase
    .from("athlete_metrics_snapshots")
    .select("mirror_data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const mirror = (snapshot?.mirror_data ?? null) as MirrorData | null;
  const todayReadiness = mirror?.readiness_today?.decision ?? null;
  const todayKey = JS_DAY_TO_KEY[new Date().getDay()];
  const todayDate = new Date().toISOString().slice(0, 10);

  const meta = plan?.validation_metadata ?? null;
  const daysToEvent = meta?.days_to_event ?? null;

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {plan ? `Settimana del ${formatDate(plan.week_start)}` : "Piano settimanale"}
          </h1>
          {plan && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-secondary">
              <span
                className={`rounded-full border px-3 py-0.5 font-medium ${PHASE_BADGE[plan.phase].classes}`}
              >
                Fase: {PHASE_BADGE[plan.phase].label}
              </span>
              {daysToEvent != null && (
                <span>· {daysToEvent} giorni all&apos;evento</span>
              )}
              {meta?.hard_sessions != null && (
                <span>
                  · {meta.hard_sessions} sedute dure
                  {meta.hard_spacing_ok === false ? " · spacing da rivedere" : ""}
                </span>
              )}
              {meta?.volume_hours_estimate != null && (
                <span>· ~{meta.volume_hours_estimate}h stimate</span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <GenerateWeekButton hasPlan={plan != null} />
          {plan && (
            <PushButton
              pushedAt={plan.pushed_at}
              canWriteCalendar={canWriteCalendar}
            />
          )}
        </div>
      </div>

      {!plan && (
        <div className="panel text-center text-muted">
          Nessun piano ancora. Premi «Genera settimana» per costruire la tua
          settimana di allenamento dai tuoi dati (fase, readiness, dossier,
          analisi evento).
        </div>
      )}

      {plan && (
        <>
          {meta?.phase_reason && (
            <p className="rounded-[11px] border border-border bg-surface p-4 text-sm text-secondary">
              {meta.phase_reason}
            </p>
          )}

          <RedistributeSection
            sessions={plan.sessions}
            weekStart={plan.week_start}
            todayKey={todayKey}
            todayReadiness={todayReadiness}
            pushedAt={plan.pushed_at}
            todayDate={todayDate}
          />

          {plan.narrative && (
            <section className="panel">
              <h2 className="panel-title mb-2">
                Il commento del coach
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">{plan.narrative}</p>
            </section>
          )}

          <p className="text-xs text-muted">
            Piano deterministico (Section 11 B). I target sono zone, non watt
            fissi. Le sedute riferiscono la Workout Library; l'eventuale commento
            è solo una spiegazione, non cambia le scelte.
          </p>
        </>
      )}
    </AppShell>
  );
}
