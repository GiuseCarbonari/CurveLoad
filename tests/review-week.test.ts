import assert from "node:assert/strict";
import { test } from "node:test";

import { lastClosedWeek, isInWeek } from "../lib/review/week-window";
import { summarizeActualWeek } from "../lib/review/week-actual";
import type { IntervalsActivity } from "../lib/intervals-client";

let idCounter = 0;
function activity(overrides: Partial<IntervalsActivity> = {}): IntervalsActivity {
  idCounter += 1;
  return {
    id: idCounter,
    name: "Uscita",
    type: "Ride",
    start_date_local: "2026-07-27T08:00:00",
    moving_time: 3600,
    distance: 30000,
    total_elevation_gain: 200,
    icu_training_load: 60,
    icu_weighted_avg_watts: 200,
    average_heartrate: 140,
    perceived_exertion: null,
    ...overrides,
  };
}

// --- lastClosedWeek -----------------------------------------------------------

test("lastClosedWeek: da un mercoledì torna la settimana precedente completa", () => {
  // 2026-08-05 è mercoledì. Settimana in corso: 2026-08-03 (lun) - 08-09 (dom).
  const week = lastClosedWeek("2026-08-05");
  assert.equal(week.weekStart, "2026-07-27");
  assert.equal(week.weekEnd, "2026-08-02");
});

test("lastClosedWeek: da un lunedì la settimana chiusa finisce ieri", () => {
  const week = lastClosedWeek("2026-08-03");
  assert.equal(week.weekStart, "2026-07-27");
  assert.equal(week.weekEnd, "2026-08-02");
});

// --- isInWeek -------------------------------------------------------------------

test("isInWeek: include gli estremi", () => {
  const week = { weekStart: "2026-07-27", weekEnd: "2026-08-02" };
  assert.equal(isInWeek("2026-07-27T23:00:00", week), true);
  assert.equal(isInWeek("2026-08-02T00:01:00", week), true);
  assert.equal(isInWeek("2026-08-03T00:00:00", week), false);
  assert.equal(isInWeek("2026-07-26T23:59:00", week), false);
});

// --- summarizeActualWeek --------------------------------------------------------

const WEEK = { weekStart: "2026-07-27", weekEnd: "2026-08-02" };

test("summarizeActualWeek: somma volume, dislivello, carico, conta per sport", () => {
  const activities = [
    activity({ start_date_local: "2026-07-27T08:00:00", moving_time: 3600, total_elevation_gain: 200, icu_training_load: 60, type: "Ride" }),
    activity({ start_date_local: "2026-07-29T08:00:00", moving_time: 1800, total_elevation_gain: 100, icu_training_load: 30, type: "Run" }),
    activity({ start_date_local: "2026-08-10T08:00:00", moving_time: 9999 }), // fuori settimana
  ];
  const result = summarizeActualWeek(activities, WEEK);
  assert.equal(result.activityCount, 2);
  assert.equal(result.totalMovingMin, 90);
  assert.equal(result.totalElevationM, 300);
  assert.equal(result.totalLoad, 90);
  assert.deepEqual(result.bySport, { bike: 1, run: 1, other: 0 });
});

test("summarizeActualWeek: dislivello null se NESSUNA attività lo ha (mai zero finto)", () => {
  const activities = [
    activity({ start_date_local: "2026-07-27T08:00:00", total_elevation_gain: null }),
  ];
  const result = summarizeActualWeek(activities, WEEK);
  assert.equal(result.totalElevationM, null);
});

test("summarizeActualWeek: settimana senza attività torna zeri/null coerenti", () => {
  const result = summarizeActualWeek([], WEEK);
  assert.equal(result.activityCount, 0);
  assert.equal(result.totalMovingMin, 0);
  assert.equal(result.totalElevationM, null);
  assert.equal(result.totalLoad, null);
});

test("summarizeActualWeek: attività senza moving_time non contano", () => {
  const activities = [activity({ start_date_local: "2026-07-27T08:00:00", moving_time: null })];
  assert.equal(summarizeActualWeek(activities, WEEK).activityCount, 0);
});
