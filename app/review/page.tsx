import { redirect } from "next/navigation";

import { CurveLoadShell } from "@/components/layout/curveload-shell";
import { FeelForm } from "@/components/review/feel-form";
import type { ActualWeekSummary } from "@/lib/review/week-actual";
import type { SessionExecution, ExecutionStatus } from "@/lib/review/execution";
import type { Divergence, FeelAnswers } from "@/lib/review/feel";
import type { ReviewTrend } from "@/lib/review/trends";
import { lastClosedWeek } from "@/lib/review/week-window";
import { createClient } from "@/lib/supabase/server";

/**
 * /review — chiude la settimana appena finita: confronto piano↔reale,
 * sensazioni↔dati, tendenze, prosa AI. Server Component: se la review della
 * settimana chiusa non esiste ancora mostra il questionario (FeelForm), che
 * genera via POST /api/review; altrimenti mostra il risultato salvato.
 */

export const dynamic = "force-dynamic";

interface ReviewMetrics {
  actual: ActualWeekSummary;
  execution: SessionExecution[];
  divergences: Divergence[];
  trends: ReviewTrend[];
  hardPlanned: number;
  hardCompleted: number;
}

interface ReviewRow {
  narrative: string | null;
  metrics: ReviewMetrics;
  feel: FeelAnswers;
  generated_at: string;
}

const STATUS_LABEL: Record<ExecutionStatus, string> = {
  eseguita: "✓ Eseguita",
  parziale: "◐ Parziale",
  saltata: "✕ Saltata",
  extra: "+ Extra",
};

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const monthNames = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${weekEnd}T00:00:00`);
  return `${start.getDate()} ${monthNames[start.getMonth()]} – ${end.getDate()} ${monthNames[end.getMonth()]}`;
}

export default async function ReviewPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const week = lastClosedWeek();
  const { data: reviewRow } = await supabase
    .from("weekly_reviews")
    .select("narrative, metrics, feel, generated_at")
    .eq("user_id", user.id)
    .eq("week_start", week.weekStart)
    .maybeSingle();

  const review = (reviewRow ?? null) as ReviewRow | null;
  const weekLabel = formatWeekRange(week.weekStart, week.weekEnd);

  return (
    <CurveLoadShell>
      <div className="pt-2">
        <div className="break-words text-[11px] uppercase leading-relaxed tracking-[0.16em] text-muted">
          {weekLabel}
        </div>
        <h1 className="mt-1.5 font-serif text-[30px] font-medium leading-none text-foreground">
          Review settimanale
        </h1>
      </div>

      {!review && (
        <div className="rounded-metric border border-border bg-surface p-5">
          <FeelForm weekLabel={weekLabel} />
        </div>
      )}

      {review && (
        <>
          {review.narrative && (
            <div className="min-w-0 whitespace-pre-line rounded-metric border border-border bg-surface-2 p-4 text-[13px] leading-relaxed text-secondary">
              {review.narrative}
            </div>
          )}

          <div className="grid min-w-0 grid-cols-3 gap-2">
            <StatPill label="Minuti" value={String(review.metrics.actual.totalMovingMin)} />
            <StatPill
              label="Dislivello"
              value={
                review.metrics.actual.totalElevationM != null
                  ? `${review.metrics.actual.totalElevationM} m`
                  : "—"
              }
            />
            <StatPill
              label="Dure"
              value={`${review.metrics.hardCompleted}/${review.metrics.hardPlanned}`}
            />
          </div>

          {review.metrics.execution.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-accent2">
                Seduta per seduta
              </div>
              <div className="space-y-1.5">
                {review.metrics.execution.map((e) => (
                  <div
                    key={e.date}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-metric border border-border bg-surface px-3 py-2 text-[13px]"
                  >
                    <span className="min-w-0 truncate text-secondary">
                      {e.planned?.title ?? `${e.date} — attività non pianificata`}
                    </span>
                    <span className="shrink-0 text-muted">
                      {e.dataUnavailable === "strava"
                        ? "⚠ Da Strava, dati non disponibili"
                        : STATUS_LABEL[e.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {review.metrics.divergences.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-accent2">
                Sensazioni vs dati
              </div>
              <div className="space-y-1.5">
                {review.metrics.divergences.map((d) => (
                  <p
                    key={d.code}
                    className="rounded-metric border border-border bg-surface px-3 py-2 text-[13px] leading-relaxed text-secondary"
                  >
                    {d.text}
                  </p>
                ))}
              </div>
            </div>
          )}

          {review.metrics.trends.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-accent2">Tendenze</div>
              <div className="space-y-1.5">
                {review.metrics.trends.map((t) => (
                  <p
                    key={t.code}
                    className="rounded-metric border border-border bg-surface px-3 py-2 text-[13px] leading-relaxed text-secondary"
                  >
                    {t.text}
                  </p>
                ))}
              </div>
            </div>
          )}

          <details className="rounded-metric border border-border bg-surface p-4">
            <summary className="cursor-pointer text-sm text-muted">
              Rigenera la review (nuove risposte)
            </summary>
            <div className="mt-4">
              <FeelForm weekLabel={weekLabel} prefill={review.feel} />
            </div>
          </details>
        </>
      )}
    </CurveLoadShell>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-metric border border-border bg-surface px-3 py-2.5 text-center">
      <div className="truncate text-[10px] uppercase tracking-[0.1em] text-faint">{label}</div>
      <div className="mt-0.5 truncate text-base font-medium text-foreground">{value}</div>
    </div>
  );
}
