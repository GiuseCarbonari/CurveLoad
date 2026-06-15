import { redirect } from "next/navigation";

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
  base: { label: "Base", classes: "border-sky-500 bg-sky-50 text-sky-900" },
  build: { label: "Build", classes: "border-orange-500 bg-orange-50 text-orange-900" },
  peak: { label: "Peak", classes: "border-red-500 bg-red-50 text-red-900" },
  taper: { label: "Taper", classes: "border-purple-500 bg-purple-50 text-purple-900" },
  recovery: { label: "Recovery", classes: "border-green-600 bg-green-50 text-green-900" },
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
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <a href="/dashboard" className="text-sm text-muted-foreground underline">
              ← dashboard
            </a>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {plan ? `Settimana del ${formatDate(plan.week_start)}` : "Piano settimanale"}
          </h1>
          {plan && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span
                className={`rounded-full border px-3 py-0.5 font-medium ${PHASE_BADGE[plan.phase].classes}`}
              >
                Fase: {PHASE_BADGE[plan.phase].label}
              </span>
              {daysToEvent != null && (
                <span className="text-muted-foreground">· {daysToEvent} giorni all'evento</span>
              )}
              {meta?.hard_sessions != null && (
                <span className="text-muted-foreground">
                  · {meta.hard_sessions} sedute dure
                  {meta.hard_spacing_ok === false ? " ⚠ spacing" : ""}
                </span>
              )}
              {meta?.volume_hours_estimate != null && (
                <span className="text-muted-foreground">· ~{meta.volume_hours_estimate}h stimate</span>
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
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          Nessun piano ancora. Premi «Genera settimana» per costruire la tua
          settimana di allenamento dai tuoi dati (fase, readiness, dossier,
          analisi evento).
        </div>
      )}

      {plan && (
        <>
          {meta?.phase_reason && (
            <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
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
            <section className="rounded-lg border bg-card p-5">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Il commento del coach
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed">{plan.narrative}</p>
            </section>
          )}

          <p className="text-xs text-muted-foreground">
            Piano deterministico (Section 11 B). I target sono zone, non watt
            fissi. Le sedute riferiscono la Workout Library; l'eventuale commento
            è solo una spiegazione, non cambia le scelte.
          </p>
        </>
      )}
    </main>
  );
}
