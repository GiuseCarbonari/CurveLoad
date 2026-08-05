import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCompletionByDate,
  buildComplianceByDate,
  normalizeCompliance,
} from "../lib/planner/compliance";
import type { BuiltSession } from "../lib/planner/build-week";
import type { IntervalsActivity } from "../lib/intervals-client";

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

// --- normalizeCompliance -----------------------------------------------------

test("normalizeCompliance: null se mancante o non finito", () => {
  assert.equal(normalizeCompliance(null), null);
  assert.equal(normalizeCompliance(NaN), null);
});

test("normalizeCompliance: 0-1 diventa percentuale", () => {
  assert.equal(normalizeCompliance(0.85), 85);
});

test("normalizeCompliance: già 0-100 resta clampato e arrotondato", () => {
  assert.equal(normalizeCompliance(97.6), 98);
  assert.equal(normalizeCompliance(150), 100);
  assert.equal(normalizeCompliance(-5), 0);
});

// --- buildComplianceByDate ----------------------------------------------------

test("buildComplianceByDate: tiene il massimo per data", () => {
  const activities = [
    activity({ start_date_local: "2026-07-27T08:00:00", compliance: 0.7 }),
    activity({ start_date_local: "2026-07-27T18:00:00", compliance: 0.9 }),
  ];
  const result = buildComplianceByDate(activities);
  assert.equal(result["2026-07-27"], 90);
});

test("buildComplianceByDate: ignora attività senza compliance", () => {
  const activities = [activity({ compliance: null })];
  assert.deepEqual(buildComplianceByDate(activities), {});
});

// --- buildCompletionByDate ----------------------------------------------------

test("buildCompletionByDate: usa la compliance Intervals quando presente", () => {
  const sessions = [session({ date: "2026-07-27", estimated_duration_min: 60 })];
  const activities = [
    activity({ start_date_local: "2026-07-27T08:00:00", moving_time: 3600, compliance: 0.95 }),
  ];
  const result = buildCompletionByDate(sessions, activities);
  assert.equal(result["2026-07-27"].percent, 95);
  assert.equal(result["2026-07-27"].source, "intervals");
});

test("buildCompletionByDate: fallback su durata quando manca compliance", () => {
  const sessions = [session({ date: "2026-07-27", estimated_duration_min: 60 })];
  const activities = [
    activity({ start_date_local: "2026-07-27T08:00:00", moving_time: 1800, compliance: null }),
  ];
  const result = buildCompletionByDate(sessions, activities);
  assert.equal(result["2026-07-27"].percent, 50);
  assert.equal(result["2026-07-27"].source, "duration");
});

test("buildCompletionByDate: ignora attività senza seduta pianificata quel giorno", () => {
  const sessions = [session({ date: "2026-07-27" })];
  const activities = [activity({ start_date_local: "2026-07-28T08:00:00" })];
  assert.deepEqual(buildCompletionByDate(sessions, activities), {});
});

test("buildCompletionByDate: giorni di riposo non contano come pianificati", () => {
  const sessions = [session({ date: "2026-07-27", rest: true, estimated_duration_min: null })];
  const activities = [activity({ start_date_local: "2026-07-27T08:00:00" })];
  assert.deepEqual(buildCompletionByDate(sessions, activities), {});
});
