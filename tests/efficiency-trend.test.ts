import assert from "node:assert/strict";
import { test } from "node:test";

import {
  activityEfficiency,
  computeEfficiencyTrend,
  filterEnduranceRides,
} from "../lib/efficiency-trend";
import type { IntervalsActivity } from "../lib/intervals-client";

/**
 * Test del trend di efficienza aerobica (W/battito, solo ciclismo).
 * computeEfficiencyTrend è pura: questi test fissano formula, filtro e
 * interpretazione attesi.
 */

let idCounter = 0;

/** Attività "sana" di default (Ride valida 60 min, 200W, 140bpm → 1.429 W/bpm). */
function activity(overrides: Partial<IntervalsActivity> = {}): IntervalsActivity {
  idCounter += 1;
  return {
    id: idCounter,
    name: "Uscita",
    type: "Ride",
    start_date_local: "2026-06-01T08:00:00",
    moving_time: 3600,
    distance: 30000,
    icu_training_load: 60,
    icu_weighted_avg_watts: 200,
    average_heartrate: 140,
    perceived_exertion: null,
    ...overrides,
  };
}

// --- activityEfficiency -------------------------------------------------------

test("activityEfficiency: calcola watts/hr corretto", () => {
  const a = activity({ icu_weighted_avg_watts: 210, average_heartrate: 140 });
  assert.equal(activityEfficiency(a), 1.5);
});

test("activityEfficiency: null se watts mancante o zero", () => {
  assert.equal(activityEfficiency(activity({ icu_weighted_avg_watts: null })), null);
  assert.equal(activityEfficiency(activity({ icu_weighted_avg_watts: 0 })), null);
});

test("activityEfficiency: null se hr mancante o zero", () => {
  assert.equal(activityEfficiency(activity({ average_heartrate: null })), null);
  assert.equal(activityEfficiency(activity({ average_heartrate: 0 })), null);
});

// --- filterEnduranceRides ------------------------------------------------------

test("filterEnduranceRides: esclude Run", () => {
  const rides = [activity(), activity({ type: "Run" })];
  const result = filterEnduranceRides(rides);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "Ride");
});

test("filterEnduranceRides: include GravelRide", () => {
  const rides = [activity({ type: "GravelRide" })];
  const result = filterEnduranceRides(rides);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "GravelRide");
});

test("filterEnduranceRides: moving_time esattamente 1800 è incluso (bordo)", () => {
  const rides = [activity({ moving_time: 1800 })];
  assert.equal(filterEnduranceRides(rides).length, 1);
});

test("filterEnduranceRides: esclude attività senza potenza o FC", () => {
  const rides = [
    activity(),
    activity({ icu_weighted_avg_watts: null }),
    activity({ average_heartrate: null }),
  ];
  assert.equal(filterEnduranceRides(rides).length, 1);
});

test("filterEnduranceRides: esclude moving_time < 1800", () => {
  const rides = [activity(), activity({ moving_time: 1799 })];
  assert.equal(filterEnduranceRides(rides).length, 1);
});

test("filterEnduranceRides: esclude l'outlier > 2x mediana", () => {
  // 3 attività normali a ~1.43 W/bpm, mediana ~1.43. Un outlier a 300/100=3.0
  // supera 2x la mediana (~2.86) e va escluso.
  const rides = [
    activity({ icu_weighted_avg_watts: 200, average_heartrate: 140 }),
    activity({ icu_weighted_avg_watts: 205, average_heartrate: 143 }),
    activity({ icu_weighted_avg_watts: 195, average_heartrate: 137 }),
    activity({ icu_weighted_avg_watts: 300, average_heartrate: 100 }),
  ];
  const result = filterEnduranceRides(rides);
  assert.equal(result.length, 3);
  assert.ok(result.every((a) => a.icu_weighted_avg_watts !== 300));
});

test("filterEnduranceRides: efficienza esattamente = 2x mediana è inclusa (bordo, non un outlier)", () => {
  // 3 attività a 1.4 W/bpm (mediana 1.4), una a esattamente 2.8 W/bpm (= 2x mediana).
  // Il criterio scarta solo efficiency > 2x mediana, quindi il bordo esatto resta.
  const rides = [
    activity({ icu_weighted_avg_watts: 140, average_heartrate: 100 }),
    activity({ icu_weighted_avg_watts: 140, average_heartrate: 100 }),
    activity({ icu_weighted_avg_watts: 140, average_heartrate: 100 }),
    activity({ icu_weighted_avg_watts: 280, average_heartrate: 100 }),
  ];
  const result = filterEnduranceRides(rides);
  assert.equal(result.length, 4);
  assert.ok(result.some((a) => a.icu_weighted_avg_watts === 280));
});

// --- computeEfficiencyTrend ----------------------------------------------------

/** Costruisce una attività per una data settimana con efficienza data (140bpm fisso). */
function weekActivity(weekOffset: number, efficiency: number): IntervalsActivity {
  const base = new Date("2026-06-01T08:00:00"); // lunedì
  base.setDate(base.getDate() + weekOffset * 7);
  const hr = 140;
  return activity({
    start_date_local: base.toISOString().slice(0, 19),
    icu_weighted_avg_watts: Math.round(efficiency * hr),
    average_heartrate: hr,
  });
}

test("computeEfficiencyTrend: serie in salita → in miglioramento", () => {
  const activities = [
    weekActivity(0, 1.3),
    weekActivity(1, 1.35),
    weekActivity(2, 1.4),
    weekActivity(3, 1.45),
    weekActivity(4, 1.5),
  ];
  const trend = computeEfficiencyTrend(activities);
  assert.equal(trend.interpretation, "in miglioramento");
  assert.ok(trend.slopePct != null && trend.slopePct >= 1.5);
});

test("computeEfficiencyTrend: serie piatta → stabile", () => {
  const activities = [
    weekActivity(0, 1.4),
    weekActivity(1, 1.4),
    weekActivity(2, 1.4),
    weekActivity(3, 1.4),
  ];
  const trend = computeEfficiencyTrend(activities);
  assert.equal(trend.interpretation, "stabile");
});

test("computeEfficiencyTrend: serie in discesa → in calo", () => {
  const activities = [
    weekActivity(0, 1.5),
    weekActivity(1, 1.45),
    weekActivity(2, 1.4),
    weekActivity(3, 1.35),
    weekActivity(4, 1.3),
  ];
  const trend = computeEfficiencyTrend(activities);
  assert.equal(trend.interpretation, "in calo");
  assert.ok(trend.slopePct != null && trend.slopePct <= -1.5);
});

test("computeEfficiencyTrend: < 3 settimane → dati insufficienti con slopePct null", () => {
  const activities = [weekActivity(0, 1.4), weekActivity(1, 1.42)];
  const trend = computeEfficiencyTrend(activities);
  assert.equal(trend.interpretation, "dati insufficienti");
  assert.equal(trend.slopePct, null);
});

test("computeEfficiencyTrend: nessuna attività valida → dati insufficienti", () => {
  const trend = computeEfficiencyTrend([]);
  assert.equal(trend.interpretation, "dati insufficienti");
  assert.equal(trend.slopePct, null);
  assert.equal(trend.points.length, 0);
});

test("computeEfficiencyTrend: solo attività scartabili (no potenza/FC, tipo errato) → dati insufficienti senza crash", () => {
  const activities = [
    activity({ icu_weighted_avg_watts: null }),
    activity({ average_heartrate: null }),
    activity({ type: "Run" }),
    activity({ moving_time: 900 }),
  ];
  const trend = computeEfficiencyTrend(activities);
  assert.equal(trend.interpretation, "dati insufficienti");
  assert.equal(trend.slopePct, null);
  assert.equal(trend.points.length, 0);
});

test("computeEfficiencyTrend: slopePct esattamente +1.5 (bordo) → in miglioramento", () => {
  const activities = [
    weekActivity(0, 193 / 140),
    weekActivity(1, 196 / 140),
    weekActivity(2, 199 / 140),
  ];
  const trend = computeEfficiencyTrend(activities);
  assert.equal(trend.slopePct, 1.5);
  assert.equal(trend.interpretation, "in miglioramento");
});

test("computeEfficiencyTrend: appena sotto +1.5 → stabile (non in miglioramento)", () => {
  const activities = [
    weekActivity(0, 194 / 140),
    weekActivity(1, 196 / 140),
    weekActivity(2, 199 / 140),
  ];
  const trend = computeEfficiencyTrend(activities);
  assert.ok(trend.slopePct != null && trend.slopePct < 1.5);
  assert.equal(trend.interpretation, "stabile");
});

test("computeEfficiencyTrend: slopePct esattamente -1.5 (bordo) → in calo", () => {
  const activities = [
    weekActivity(0, 199 / 140),
    weekActivity(1, 196 / 140),
    weekActivity(2, 193 / 140),
  ];
  const trend = computeEfficiencyTrend(activities);
  assert.equal(trend.slopePct, -1.5);
  assert.equal(trend.interpretation, "in calo");
});

test("computeEfficiencyTrend: appena sopra -1.5 → stabile (non in calo)", () => {
  const activities = [
    weekActivity(0, 199 / 140),
    weekActivity(1, 196 / 140),
    weekActivity(2, 194 / 140),
  ];
  const trend = computeEfficiencyTrend(activities);
  assert.ok(trend.slopePct != null && trend.slopePct > -1.5);
  assert.equal(trend.interpretation, "stabile");
});

test("computeEfficiencyTrend: settimane a cavallo di anno (dic 2025 -> gen 2026) raggruppate correttamente", () => {
  // Lunedì 29 dic 2025 e domenica 4 gen 2026 sono nella STESSA settimana ISO
  // (weekStart 2025-12-29); il 5 gen 2026 (lunedì) è la settimana successiva.
  const sameWeekA = activity({ start_date_local: "2025-12-29T08:00:00", icu_weighted_avg_watts: 200 });
  const sameWeekB = activity({ start_date_local: "2026-01-04T08:00:00", icu_weighted_avg_watts: 210 });
  const nextWeek = activity({ start_date_local: "2026-01-05T08:00:00", icu_weighted_avg_watts: 205 });
  const priorWeek = activity({ start_date_local: "2025-12-22T08:00:00", icu_weighted_avg_watts: 195 });
  const trend = computeEfficiencyTrend([priorWeek, sameWeekA, sameWeekB, nextWeek]);
  assert.equal(trend.points.length, 3);
  const crossYearWeek = trend.points.find((p) => p.weekStart === "2025-12-29");
  assert.ok(crossYearWeek, "settimana a cavallo d'anno non trovata");
  assert.equal(crossYearWeek!.count, 2);
});

test("computeEfficiencyTrend: più attività nella stessa settimana → media della settimana", () => {
  const w0a = weekActivity(0, 1.2);
  const w0b = weekActivity(0, 1.4);
  const activities = [w0a, w0b, weekActivity(1, 1.3), weekActivity(2, 1.3)];
  const trend = computeEfficiencyTrend(activities);
  const firstWeek = trend.points[0];
  assert.equal(firstWeek.count, 2);
  assert.equal(firstWeek.efficiency, 1.3);
});
