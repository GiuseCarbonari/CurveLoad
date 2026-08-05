import type { IntervalsActivity } from "@/lib/intervals-client";
import { isInWeek, type WeekWindow } from "@/lib/review/week-window";

/**
 * Riepilogo REALE della settimana (volume, dislivello, carico, sport) dalle
 * attività Intervals — funzione pura, nessun ricalcolo di metriche già lette
 * (icu_training_load, total_elevation_gain sono valori Intervals, non stime).
 * Ogni somma resta `null` se NESSUNA attività della settimana ha quel campo,
 * per non far sembrare "0" un dato che non c'è (No Virtual Math).
 */

const RIDE_TYPES = new Set(["Ride", "VirtualRide", "MountainBikeRide", "GravelRide"]);
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

export interface ActualWeekSummary {
  activityCount: number;
  totalMovingMin: number;
  totalDistanceKm: number | null;
  totalElevationM: number | null;
  totalLoad: number | null;
  bySport: { bike: number; run: number; other: number };
}

export function summarizeActualWeek(
  activities: IntervalsActivity[],
  week: WeekWindow
): ActualWeekSummary {
  const inWeek = activities.filter(
    (a) => a.moving_time != null && a.moving_time > 0 && isInWeek(a.start_date_local, week)
  );

  let totalMovingMin = 0;
  let distanceSum = 0;
  let distanceCount = 0;
  let elevationSum = 0;
  let elevationCount = 0;
  let loadSum = 0;
  let loadCount = 0;
  let bike = 0;
  let run = 0;
  let other = 0;

  for (const a of inWeek) {
    totalMovingMin += (a.moving_time ?? 0) / 60;
    if (a.distance != null) {
      distanceSum += a.distance;
      distanceCount++;
    }
    if (a.total_elevation_gain != null) {
      elevationSum += a.total_elevation_gain;
      elevationCount++;
    }
    if (a.icu_training_load != null) {
      loadSum += a.icu_training_load;
      loadCount++;
    }
    if (a.type != null && RIDE_TYPES.has(a.type)) bike++;
    else if (a.type != null && RUN_TYPES.has(a.type)) run++;
    else other++;
  }

  return {
    activityCount: inWeek.length,
    totalMovingMin: Math.round(totalMovingMin),
    totalDistanceKm: distanceCount > 0 ? Math.round((distanceSum / 1000) * 10) / 10 : null,
    totalElevationM: elevationCount > 0 ? Math.round(elevationSum) : null,
    totalLoad: loadCount > 0 ? Math.round(loadSum) : null,
    bySport: { bike, run, other },
  };
}
