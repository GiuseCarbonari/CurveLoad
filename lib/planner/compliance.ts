import type { MirrorData } from "@/lib/intervals/sync";
import type { BuiltSession } from "@/lib/planner/build-week";

/** Compliance grezza di Intervals (0–1 o 0–100) → percentuale 0–100 arrotondata, o null. */
export function normalizeCompliance(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

/**
 * Compliance 0–100 per data, dalle attività Intervals (gate progressione §5.2).
 * Tiene il massimo per data quando più attività cadono sullo stesso giorno.
 */
export function buildComplianceByDate(
  activities: MirrorData["activities_90d"]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const a of activities) {
    const pct = normalizeCompliance(a.compliance ?? null);
    if (pct == null) continue;
    const date = a.start_date_local.slice(0, 10);
    if (result[date] == null || pct > result[date]) result[date] = pct;
  }
  return result;
}

export interface DateCompletion {
  percent: number;
  label: string;
  source: "intervals" | "duration";
}

/**
 * Percentuale di completamento per data: compliance Intervals se disponibile,
 * altrimenti rapporto durata reale/pianificata della seduta di quel giorno.
 * Tiene il massimo per data (più attività nello stesso giorno).
 */
export function buildCompletionByDate(
  sessions: BuiltSession[],
  activities: MirrorData["activities_90d"]
): Record<string, DateCompletion> {
  const plannedByDate = new Map(
    sessions
      .filter((session) => !session.rest && session.estimated_duration_min != null)
      .map((session) => [session.date, session])
  );
  const result: Record<string, DateCompletion> = {};

  for (const activity of activities) {
    const date = activity.start_date_local.slice(0, 10);
    const session = plannedByDate.get(date);
    if (!session || activity.moving_time == null || activity.moving_time <= 0) {
      continue;
    }

    const compliance = normalizeCompliance(activity.compliance ?? null);
    const plannedSeconds = (session.estimated_duration_min ?? 0) * 60;
    const percent =
      compliance ??
      (plannedSeconds > 0
        ? Math.max(
            1,
            Math.min(100, Math.round((activity.moving_time / plannedSeconds) * 100))
          )
        : null);
    if (percent == null) continue;

    const previous = result[date];
    if (!previous || percent > previous.percent) {
      result[date] = {
        percent,
        label: `✓ ${percent}%`,
        source: compliance != null ? "intervals" : "duration",
      };
    }
  }

  return result;
}
