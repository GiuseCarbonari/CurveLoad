import assert from "node:assert/strict";
import { test } from "node:test";

import { computeMacrocycle } from "../lib/planner/macrocycle";
import { alignPhase, detectPhase, type Phase, type PhaseResult } from "../lib/planner/phase-detector";

/**
 * Test del macrociclo stagionale (Passo 8). Date fisse passate come stringhe:
 * nessun new Date() qui, computeMacrocycle è puro e riceve `today` come
 * parametro (stessa regola di detectPhase).
 */

/** PhaseResult minimo per i test di alignPhase (solo `phase` conta qui). */
function pr(phase: Phase): PhaseResult {
  return { phase, reason: "test", daysToEvent: null, ctl_slope_per_week: null, reason_code: "TEST" };
}

// --- computeMacrocycle ------------------------------------------------------

test("computeMacrocycle: nessuna gara (null) → no_race", () => {
  const m = computeMacrocycle("2026-06-01", null);
  assert.equal(m.status, "no_race");
  assert.deepEqual(m.blocks, []);
  assert.equal(m.planned_phase, null);
});

test("computeMacrocycle: stringa non valida → no_race, nessuna eccezione", () => {
  for (const bad of ["", "boh"]) {
    const m = computeMacrocycle("2026-06-01", bad);
    assert.equal(m.status, "no_race");
    assert.deepEqual(m.blocks, []);
    assert.equal(m.planned_phase, null);
  }
});

test("computeMacrocycle: gara ieri → race_past", () => {
  const m = computeMacrocycle("2026-06-02", "2026-06-01");
  assert.equal(m.status, "race_past");
  assert.deepEqual(m.blocks, []);
  assert.equal(m.planned_phase, null);
});

test("computeMacrocycle: gara oggi → un solo blocco taper", () => {
  const m = computeMacrocycle("2026-06-01", "2026-06-01");
  assert.equal(m.days_to_race, 0);
  assert.equal(m.blocks.length, 1);
  assert.equal(m.blocks[0].phase, "taper");
  assert.equal(m.blocks[0].start, "2026-06-01");
  assert.equal(m.blocks[0].end, "2026-06-01");
  assert.equal(m.planned_phase, "taper");
});

test("computeMacrocycle: gara tra 5 giorni → un solo blocco taper", () => {
  const m = computeMacrocycle("2026-06-01", "2026-06-06");
  assert.equal(m.blocks.length, 1);
  assert.equal(m.blocks[0].phase, "taper");
  assert.equal(m.blocks[0].start, "2026-06-01");
  assert.equal(m.blocks[0].end, "2026-06-06");
});

test("computeMacrocycle: gara tra 30 giorni → solo peak + taper", () => {
  const m = computeMacrocycle("2026-06-01", "2026-07-01");
  assert.deepEqual(m.blocks.map((b) => b.phase), ["peak", "taper"]);
  const taper = m.blocks.find((b) => b.phase === "taper")!;
  assert.equal(taper.days, 14);
  assert.equal(taper.end, "2026-07-01");
});

test("computeMacrocycle: gara tra 365 giorni → 4 blocchi base/build/peak/taper", () => {
  const m = computeMacrocycle("2026-01-01", "2027-01-01");
  assert.deepEqual(m.blocks.map((b) => b.phase), ["base", "build", "peak", "taper"]);
  assert.equal(m.blocks.find((b) => b.phase === "taper")!.days, 14);
  assert.equal(m.blocks.find((b) => b.phase === "peak")!.days, 29);
  assert.equal(m.blocks.find((b) => b.phase === "build")!.days, 56);
  assert.equal(m.planned_phase, "base");
});

test("computeMacrocycle: invarianti (30 e 365 giorni)", () => {
  const m30 = computeMacrocycle("2026-06-01", "2026-07-01");
  assert.equal(m30.blocks[0].start, "2026-06-01");
  assert.equal(m30.blocks.at(-1)!.end, "2026-07-01");
  assertContiguousAndPositive(m30);
  assert.equal(
    m30.blocks.reduce((sum, b) => sum + b.days, 0),
    m30.days_to_race! + 1
  );

  const m365 = computeMacrocycle("2026-01-01", "2027-01-01");
  assert.equal(m365.blocks[0].start, "2026-01-01");
  assert.equal(m365.blocks.at(-1)!.end, "2027-01-01");
  assertContiguousAndPositive(m365);
  assert.equal(
    m365.blocks.reduce((sum, b) => sum + b.days, 0),
    m365.days_to_race! + 1
  );
});

function assertContiguousAndPositive(m: ReturnType<typeof computeMacrocycle>) {
  for (const b of m.blocks) {
    assert.ok(b.days > 0, `blocco ${b.phase} con days <= 0`);
  }
  for (let i = 0; i < m.blocks.length - 1; i++) {
    const end = new Date(`${m.blocks[i].end}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    assert.equal(end.toISOString().slice(0, 10), m.blocks[i + 1].start);
  }
}

test("computeMacrocycle: ancoraggio alla gara (today +7 giorni, stessa gara)", () => {
  const m1 = computeMacrocycle("2026-01-01", "2027-01-01");
  const m2 = computeMacrocycle("2026-01-08", "2027-01-01");

  for (const phase of ["build", "peak", "taper"] as const) {
    const b1 = m1.blocks.find((b) => b.phase === phase);
    const b2 = m2.blocks.find((b) => b.phase === phase);
    assert.ok(b1 && b2, `blocco ${phase} presente in entrambi`);
    assert.equal(b1!.start, b2!.start, `${phase}.start non cambia`);
  }
});

test("computeMacrocycle: coerenza con detectPhase ai confini 13/14/42/43", () => {
  const cases: Array<[number, Phase]> = [
    [13, "taper"],
    [14, "peak"],
    [42, "peak"],
    [43, "build"],
  ];
  const today = "2026-01-01";
  for (const [daysToEvent, expected] of cases) {
    const raceDate = addDaysUTC(today, daysToEvent);
    const m = computeMacrocycle(today, raceDate);
    assert.equal(m.blocks[0].phase, expected, `daysToEvent=${daysToEvent}`);
    assert.equal(
      detectPhase(50, [50], daysToEvent, 1.0, 0.9).phase,
      expected,
      `detectPhase daysToEvent=${daysToEvent}`
    );
  }
});

function addDaysUTC(dateIso: string, offset: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

// --- alignPhase --------------------------------------------------------------

test("alignPhase: planned null → usa la fase rilevata, on_track null", () => {
  const a = alignPhase(pr("build"), null);
  assert.equal(a.phase, "build");
  assert.equal(a.on_track, null);
  assert.equal(a.reason_code, "NO_MACROCYCLE");
});

test("alignPhase: recovery rilevato → vince sempre (SAFETY_OVERRIDE)", () => {
  const a = alignPhase(pr("recovery"), "build");
  assert.equal(a.phase, "recovery");
  assert.equal(a.on_track, false);
  assert.equal(a.reason_code, "SAFETY_OVERRIDE");
});

test("alignPhase: finestra di gara (taper/peak) → RACE_WINDOW", () => {
  const a = alignPhase(pr("taper"), "base");
  assert.equal(a.phase, "taper");
  assert.equal(a.reason_code, "RACE_WINDOW");
});

test("alignPhase: base rilevato ma pianificato build → OFF_TRACK", () => {
  const a = alignPhase(pr("base"), "build");
  assert.equal(a.phase, "build");
  assert.equal(a.on_track, false);
  assert.equal(a.reason_code, "OFF_TRACK");
});

test("alignPhase: build rilevato e pianificato → ON_TRACK", () => {
  const a = alignPhase(pr("build"), "build");
  assert.equal(a.phase, "build");
  assert.equal(a.on_track, true);
  assert.equal(a.reason_code, "ON_TRACK");
});
