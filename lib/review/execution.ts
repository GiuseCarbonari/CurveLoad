import type { BuiltSession } from "@/lib/planner/build-week";
import type { IntervalsActivity } from "@/lib/intervals-client";
import type { MirrorData } from "@/lib/intervals/sync";
import { buildCompletionByDate, type DateCompletion } from "@/lib/planner/compliance";
import { isInWeek, type WeekWindow } from "@/lib/review/week-window";

/**
 * Abbinamento piano↔reale per data — riusa buildCompletionByDate (già in
 * lib/planner/compliance.ts, condivisa con /plan) invece di ricalcolare la
 * stessa logica di percentuale/compliance.
 */

export type ExecutionStatus = "eseguita" | "parziale" | "saltata" | "extra";

const PARTIAL_THRESHOLD_PCT = 70;

export interface SessionExecution {
  date: string;
  day: BuiltSession["day"] | null;
  planned: {
    title: string;
    is_hard: boolean;
    sport: string;
    estimated_duration_min: number | null;
    session_objective: string;
    library_id: string | null;
  } | null;
  status: ExecutionStatus;
  completion: DateCompletion | null;
  activity: { id: string | number; type: string | null; moving_time: number | null } | null;
  /**
   * "strava" se quel giorno risulta un'attività ma Intervals.icu non ne
   * fornisce i dati perché la fonte è Strava (verificato via probe reale,
   * docs/INTERVALS_API_NOTES.md) — non è una seduta davvero saltata, sono
   * dati che Intervals stesso non restituisce.
   */
  dataUnavailable: "strava" | null;
}

export function matchPlanToActual(
  sessions: BuiltSession[],
  activities: MirrorData["activities_90d"],
  week: WeekWindow
): SessionExecution[] {
  const weekSessions = sessions.filter((s) => isInWeek(s.date, week));
  const weekActivities = activities.filter((a) => isInWeek(a.start_date_local, week));
  const completion = buildCompletionByDate(weekSessions, weekActivities);

  const activityByDate = new Map<string, IntervalsActivity>();
  for (const a of weekActivities) {
    const date = a.start_date_local.slice(0, 10);
    const previous = activityByDate.get(date);
    if (!previous || (a.moving_time ?? 0) > (previous.moving_time ?? 0)) {
      activityByDate.set(date, a);
    }
  }

  const results: SessionExecution[] = [];
  const plannedDates = new Set<string>();

  for (const s of weekSessions) {
    if (s.rest) continue;
    plannedDates.add(s.date);
    const c = completion[s.date] ?? null;
    const activity = activityByDate.get(s.date) ?? null;
    const status: ExecutionStatus =
      c == null ? "saltata" : c.percent < PARTIAL_THRESHOLD_PCT ? "parziale" : "eseguita";
    const dataUnavailable: SessionExecution["dataUnavailable"] =
      activity != null &&
      activity.source === "STRAVA" &&
      (activity.moving_time == null || activity.moving_time <= 0)
        ? "strava"
        : null;

    results.push({
      date: s.date,
      day: s.day,
      planned: {
        title: s.title,
        is_hard: s.is_hard,
        sport: s.sport,
        estimated_duration_min: s.estimated_duration_min,
        session_objective: s.session_objective,
        library_id: s.library_id,
      },
      status,
      completion: c,
      activity: activity
        ? { id: activity.id, type: activity.type, moving_time: activity.moving_time }
        : null,
      dataUnavailable,
    });
  }

  // Attività vere senza seduta pianificata quel giorno: extra rispetto al piano.
  for (const a of weekActivities) {
    const date = a.start_date_local.slice(0, 10);
    if (plannedDates.has(date)) continue;
    if (a.moving_time == null || a.moving_time <= 0) continue;
    results.push({
      date,
      day: null,
      planned: null,
      status: "extra",
      completion: null,
      activity: { id: a.id, type: a.type, moving_time: a.moving_time },
      dataUnavailable: null,
    });
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}
