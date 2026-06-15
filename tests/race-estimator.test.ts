import assert from "node:assert/strict";
import { test } from "node:test";

import type { TerrainSummary } from "../lib/terrain/gpx-parser";
import {
  buildPacingPlan,
  computeRaceEstimate,
  estimateRaceTime,
  fatigueMultiplier,
  solveVelocity,
} from "../lib/terrain/race-estimator";

/**
 * Test del modello fisico di stima gara (PRD §33). Verificano invarianti
 * robuste (monotonìa, clamp, ordinamento scenari, struttura del piano) e un
 * sanity range su un percorso sintetico ~88 km / ~4000 m D+, senza dipendere
 * da un GPX reale.
 */

const CP_W = 238;
const WEIGHT = 76.2;

/** Polyline sintetica: N punti ogni 500 m con elevazione data da `eleAt`. */
function makeTerrain(
  distanceKm: number,
  eleAt: (km: number) => number,
  climbs: TerrainSummary["climbs"] = []
): TerrainSummary {
  const polyline: Array<[number, number, number, number]> = [];
  const steps = Math.round(distanceKm / 0.5);
  let dPlus = 0;
  let prevEle = eleAt(0);
  for (let i = 0; i <= steps; i++) {
    const km = i * 0.5;
    const ele = eleAt(km);
    if (i > 0 && ele > prevEle) dPlus += ele - prevEle;
    prevEle = ele;
    polyline.push([Number(km.toFixed(2)), 45 + i * 1e-4, 7 + i * 1e-4, Math.round(ele)]);
  }
  return {
    total_distance_km: distanceKm,
    total_elevation_m: Math.round(dPlus),
    elevation_per_km: Number((dPlus / distanceKm).toFixed(1)),
    course_character: "mountain",
    climbs,
    descents: [],
    polyline,
  };
}

test("solveVelocity: salita più ripida → più lento", () => {
  const v4 = solveVelocity(CP_W, WEIGHT, 0.04);
  const v8 = solveVelocity(CP_W, WEIGHT, 0.08);
  assert.ok(v8 < v4, "8% deve essere più lento di 4%");
});

test("solveVelocity: clamp minimo 1.5 m/s anche in salita estrema", () => {
  const v = solveVelocity(120, WEIGHT, 0.25);
  assert.ok(v >= 1.5, "mai sotto 1.5 m/s");
});

test("solveVelocity: discesa cappata a MAX_DESCENT (40 km/h)", () => {
  const v = solveVelocity(CP_W, WEIGHT, -0.12);
  assert.ok(v <= 40 / 3.6 + 1e-9, "discesa non oltre 40 km/h");
});

test("fatigueMultiplier: fasce 1.0 / 0.95 / 0.88 / 0.82", () => {
  assert.equal(fatigueMultiplier(0, 100, null), 1.0);
  assert.equal(fatigueMultiplier(40, 100, null), 0.95);
  assert.equal(fatigueMultiplier(70, 100, null), 0.88);
  assert.equal(fatigueMultiplier(90, 100, null), 0.82);
});

test("estimateRaceTime: ordinamento conservativo ≥ realistico ≥ ottimistico", () => {
  const terrain = makeTerrain(40, (km) => 200 + 150 * Math.sin((km / 40) * Math.PI * 4));
  const opt = estimateRaceTime(terrain, CP_W, WEIGHT, null, "optimistic");
  const real = estimateRaceTime(terrain, CP_W, WEIGHT, null, "realistic");
  const cons = estimateRaceTime(terrain, CP_W, WEIGHT, null, "conservative");
  assert.ok(cons.total_seconds >= real.total_seconds);
  assert.ok(real.total_seconds >= opt.total_seconds);
  assert.ok(opt.avg_speed_kmh > 0);
  assert.ok(opt.segments.length > 0);
});

test("estimateRaceTime: include le soste nel totale", () => {
  const terrain = makeTerrain(20, () => 100); // piatto
  const real = estimateRaceTime(terrain, CP_W, WEIGHT, null, "realistic");
  // total = moving + 15 min di soste
  assert.equal(real.total_seconds - real.moving_seconds, 15 * 60);
});

test("computeRaceEstimate: struttura completa e split per ogni salita", () => {
  const climbs: TerrainSummary["climbs"] = [
    {
      position_km: 35,
      distance_km: 5,
      elevation_m: 400,
      avg_gradient_pct: 8,
      max_gradient_pct: 11,
      category: "Cat 2",
      start_coords: { lat: 45, lon: 7 },
      end_coords: { lat: 45.1, lon: 7.1 },
    },
  ];
  const terrain = makeTerrain(
    88,
    (km) => 300 + 200 * Math.sin((km / 88) * Math.PI * 10),
    climbs
  );
  const est = computeRaceEstimate(terrain, CP_W, WEIGHT, 45);

  assert.equal(est.cp_w, CP_W);
  assert.ok(est.scenarios.realistic.segments.length > 10);
  assert.equal(est.pacing.pacing_advice.length, 3);
  assert.ok(est.pacing.finish_range.includes("—"));
  assert.equal(est.pacing.key_splits.length, climbs.length);
  assert.ok(est.pacing.key_splits[0].eta_seconds != null);

  // Sanity range largo su un percorso da ~88 km montagnoso.
  const hours = est.scenarios.realistic.total_seconds / 3600;
  assert.ok(hours > 3 && hours < 12, `tempo realistico fuori range: ${hours}h`);
});

test("buildPacingPlan: percorso lungo/lento → warning oltre le 8h", () => {
  // Percorso durissimo: lungo e con pendenze costanti elevate.
  const terrain = makeTerrain(120, (km) => 200 + km * 60); // +6% costante
  const opt = estimateRaceTime(terrain, CP_W, WEIGHT, null, "optimistic");
  const real = estimateRaceTime(terrain, CP_W, WEIGHT, null, "realistic");
  const cons = estimateRaceTime(terrain, CP_W, WEIGHT, null, "conservative");
  const plan = buildPacingPlan({ optimistic: opt, realistic: real, conservative: cons }, terrain, WEIGHT);
  assert.ok(cons.total_seconds / 3600 > 8);
  assert.ok(plan.warning != null && plan.warning.includes("settimane"));
});
