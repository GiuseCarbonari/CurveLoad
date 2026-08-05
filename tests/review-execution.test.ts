import assert from "node:assert/strict";
import { test } from "node:test";

import { matchPlanToActual } from "../lib/review/execution";
import type { BuiltSession } from "../lib/planner/build-week";
import type { IntervalsActivity } from "../lib/intervals-client";

const WEEK = { weekStart: "2026-07-27", weekEnd: "2026-08-02" };

let idCounter = 0;
function session(overrides: Partial<BuiltSession> = {}): BuiltSession {
  return {
    day: "mon",
    date: "2026-07-27",
    is_hard: false,
    rest: false,
    title: "Lunedì — Fondo",
    sport: "Ciclismo",
    estimated_duration_min: 60,
    session_objective: "Base",
    description: "",
    interval_structure: "",
    power_target_zone: null,
    hr_target_zone: null,
    rpe_target: null,
    coach_notes: "",
    session_rationale: "",
    fatigue_alternative_library_id: null,
    library_id: "AE-1",
    frameworks_cited: [],
    validation_metadata: null,
    ...overrides,
  };
}

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

test("matchPlanToActual: seduta eseguita per intero", () => {
  const sessions = [session({ date: "2026-07-27", estimated_duration_min: 60 })];
  const activities = [
    activity({ start_date_local: "2026-07-27T08:00:00", moving_time: 3600, compliance: 1 }),
  ];
  const result = matchPlanToActual(sessions, activities, WEEK);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "eseguita");
  assert.equal(result[0].completion?.percent, 100);
});

test("matchPlanToActual: seduta parziale sotto il 70%", () => {
  const sessions = [session({ date: "2026-07-27", estimated_duration_min: 60 })];
  const activities = [
    activity({ start_date_local: "2026-07-27T08:00:00", moving_time: 1200, compliance: null }),
  ];
  const result = matchPlanToActual(sessions, activities, WEEK);
  assert.equal(result[0].status, "parziale");
});

test("matchPlanToActual: seduta saltata senza attività quel giorno", () => {
  const sessions = [session({ date: "2026-07-27" })];
  const result = matchPlanToActual(sessions, [], WEEK);
  assert.equal(result[0].status, "saltata");
  assert.equal(result[0].completion, null);
});

test("matchPlanToActual: attività senza seduta pianificata è extra", () => {
  const sessions: BuiltSession[] = [];
  const activities = [activity({ start_date_local: "2026-07-28T08:00:00", moving_time: 2400 })];
  const result = matchPlanToActual(sessions, activities, WEEK);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "extra");
  assert.equal(result[0].planned, null);
});

test("matchPlanToActual: giorni di riposo non producono righe", () => {
  const sessions = [session({ date: "2026-07-27", rest: true, estimated_duration_min: null })];
  const result = matchPlanToActual(sessions, [], WEEK);
  assert.equal(result.length, 0);
});

test("matchPlanToActual: ignora sedute e attività fuori dalla finestra", () => {
  const sessions = [session({ date: "2026-08-10" })];
  const activities = [activity({ start_date_local: "2026-08-15T08:00:00" })];
  const result = matchPlanToActual(sessions, activities, WEEK);
  assert.equal(result.length, 0);
});

test("matchPlanToActual: attività source Strava senza dati -> dataUnavailable 'strava', non conta come eseguita", () => {
  const sessions = [session({ date: "2026-07-27", estimated_duration_min: 60 })];
  const activities = [
    activity({
      start_date_local: "2026-07-27T08:00:00",
      type: undefined,
      moving_time: undefined,
      compliance: undefined,
      source: "STRAVA",
    }),
  ];
  const result = matchPlanToActual(sessions, activities, WEEK);
  assert.equal(result[0].status, "saltata");
  assert.equal(result[0].dataUnavailable, "strava");
  assert.equal(result[0].activity?.id, activities[0].id);
});

test("matchPlanToActual: attività Strava CON dati (moving_time presente) non è 'dataUnavailable'", () => {
  const sessions = [session({ date: "2026-07-27", estimated_duration_min: 60 })];
  const activities = [
    activity({ start_date_local: "2026-07-27T08:00:00", moving_time: 3600, source: "STRAVA" }),
  ];
  const result = matchPlanToActual(sessions, activities, WEEK);
  assert.equal(result[0].dataUnavailable, null);
});

test("matchPlanToActual: ordina i risultati per data", () => {
  const sessions = [
    session({ date: "2026-07-29" }),
    session({ date: "2026-07-27" }),
  ];
  const result = matchPlanToActual(sessions, [], WEEK);
  assert.deepEqual(result.map((r) => r.date), ["2026-07-27", "2026-07-29"]);
});
