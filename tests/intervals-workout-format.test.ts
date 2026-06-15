import assert from "node:assert/strict";
import { test } from "node:test";

import type { BuiltSession } from "../lib/planner/build-week";
import {
  sessionToEvent,
  stableWorkoutUid,
  toIntervalsDescription,
} from "../lib/planner/intervals-workout-format";

function session(overrides: Partial<BuiltSession> = {}): BuiltSession {
  return {
    day: "tue",
    date: "2026-06-16",
    is_hard: true,
    rest: false,
    title: "Martedì — Sweet Spot sostenuto (SS-1)",
    sport: "MTB",
    estimated_duration_min: 95,
    session_objective: "Sweet spot",
    description: "Descrizione planner",
    interval_structure: "3 × 20 min con 5 min Z1",
    power_target_zone: "Sweet Spot",
    hr_target_zone: "Z3-Z4",
    rpe_target: "RPE 7-8",
    coach_notes: "Potenza costante in ogni blocco.",
    session_rationale: "Seduta primaria.",
    fatigue_alternative_library_id: "SS-4",
    library_id: "SS-1",
    frameworks_cited: ["Coggan-Levels", "Section11-B§4"],
    validation_metadata: {
      protocol_version: "11.33",
      checklist_passed: [],
      checklist_failed: [],
      frameworks_cited: ["Coggan-Levels"],
      confidence: "high",
      phase_detected: "build",
      library_id: "SS-1",
      is_hard_session: true,
      adapted_duration_min: 95,
    },
    ...overrides,
  };
}

test("toIntervalsDescription include razionale e sintassi FTP parsabile", () => {
  const description = toIntervalsDescription(session());
  assert.match(description, /^Nota coach: Potenza costante/m);
  assert.match(description, /Framework: Coggan-Levels, Section11-B§4/);
  assert.match(description, /3x\n- 20m 88-94%\n- 5m 50-60%/);
  assert.match(description, /Cool-down\n- 10m 50-60%/);
});

test("sessionToEvent crea evento MTB con durata adattata", () => {
  const event = sessionToEvent(session(), "user-123", "2026-06-15");
  assert.equal(event.category, "WORKOUT");
  assert.equal(event.external_id, event.uid);
  assert.equal(event.start_date_local, "2026-06-16T00:00:00");
  assert.equal(event.name, "Sweet Spot sostenuto");
  assert.equal(event.type, "MountainBikeRide");
  assert.equal(event.moving_time, 95 * 60);
});

test("uid resta stabile al ri-push e cambia per data o library_id", () => {
  const uid = stableWorkoutUid("user-123", "2026-06-16", "SS-1");
  assert.equal(
    uid,
    stableWorkoutUid("user-123", "2026-06-16", "SS-1")
  );
  assert.notEqual(uid, stableWorkoutUid("user-123", "2026-06-17", "SS-1"));
  assert.notEqual(uid, stableWorkoutUid("user-123", "2026-06-16", "SS-2"));
});

test("sport indoor prevale sul tipo MTB", () => {
  const event = sessionToEvent(
    session({ sport: "indoor MTB" }),
    "user-123",
    "2026-06-15"
  );
  assert.equal(event.type, "VirtualRide");
});
