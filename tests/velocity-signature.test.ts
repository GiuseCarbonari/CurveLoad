import assert from "node:assert/strict";
import { test } from "node:test";

import type { TerrainSummary } from "../lib/terrain/gpx-parser";
import {
  archetypeSignature,
  buildAthleteSignature,
  buildSignatureFromStreams,
  type ActivityMeta,
  type ActivityStream,
  type VelocitySignature,
} from "../lib/terrain/velocity-signature";
import {
  computeRaceEstimateV2,
  estimateRaceTimeV2,
  estimateSegmentVelocity,
  validateAgainstKnown,
} from "../lib/terrain/race-estimator-v2";

/**
 * Test del modello stima tempi v2 a 3 livelli (M7). Verificano: costruzione
 * della firma dai dati 1 Hz, scelta della fonte L1/L2/L3, ordinamento scenari,
 * e — REGOLA FERMA del milestone — che l'archetipo stimi il Rampichilonero
 * entro ±20% dal reale (vs il +54% del modello fisico v1).
 */

const CP = 242;
const WEIGHT = 76.2;

/** Stream sintetici a 1 Hz: velocità costante `v`, pendenza costante `g`. */
function constantStreams(v: number, g: number, secs: number): ActivityStream[] {
  const altitude: number[] = [];
  const velocity: number[] = [];
  let alt = 100;
  for (let i = 0; i < secs; i++) {
    altitude.push(Number(alt.toFixed(3)));
    velocity.push(v);
    alt += v * g; // dislivello al secondo = v * gradiente
  }
  return [
    { type: "altitude", data: altitude },
    { type: "velocity_smooth", data: velocity },
  ];
}

/** Stream a tre segmenti: flat, salita 8%, discesa 8% (per più fasce). */
function mixedStreams(): ActivityStream[] {
  const altitude: number[] = [];
  const velocity: number[] = [];
  let alt = 100;
  const segs = [
    { g: 0, n: 200 },
    { g: 0.08, n: 200 },
    { g: -0.08, n: 200 },
  ];
  for (const s of segs) {
    for (let i = 0; i < s.n; i++) {
      altitude.push(Number(alt.toFixed(3)));
      velocity.push(5);
      alt += 5 * s.g;
    }
  }
  return [
    { type: "altitude", data: altitude },
    { type: "velocity_smooth", data: velocity },
  ];
}

/** Stream a pendenza costante `g` con pattern di velocità [{v,n}, ...]. */
function variableStreams(
  g: number,
  pattern: Array<{ v: number; n: number }>
): ActivityStream[] {
  const altitude: number[] = [];
  const velocity: number[] = [];
  let alt = 1000;
  for (const seg of pattern) {
    for (let i = 0; i < seg.n; i++) {
      altitude.push(Number(alt.toFixed(3)));
      velocity.push(seg.v);
      alt += seg.v * g; // mantiene il gradiente esatto = g
    }
  }
  return [
    { type: "altitude", data: altitude },
    { type: "velocity_smooth", data: velocity },
  ];
}

test("FIX bias discese: 75° percentile alza la velocità rappresentativa", () => {
  // Discesa −8% con tanti secondi lenti (tecnica/frenate) e meno secondi
  // veloci: la MEDIANA crollerebbe a ~2 m/s (il bias diagnosticato). Il fix
  // (75° percentile sulle discese) restituisce la velocità a cui PERCORRI.
  const streams = variableStreams(-0.1, [
    { v: 12, n: 200 },
    { v: 2, n: 200 },
  ]);
  const buckets = buildSignatureFromStreams(streams, 5000);
  const descent = buckets.find((b) => b.gradient_pct === -10);
  assert.ok(descent, "deve esserci il bucket −10%");
  // Mediana sarebbe ~2 m/s; il 75° percentile risale a ~12 m/s.
  assert.ok(descent!.velocity_ms >= 8, `discesa troppo lenta: ${descent!.velocity_ms} m/s`);
});

test("FIX bias: media pesata per distanza su piano/salita > mediana", () => {
  // Piano con secondi lenti dominanti: la media pesata per distanza dà più
  // peso ai secondi veloci (più strada) → velocità rappresentativa più alta.
  const streams = variableStreams(0, [
    { v: 4, n: 200 },
    { v: 10, n: 100 },
  ]);
  const buckets = buildSignatureFromStreams(streams, 3000);
  const flat = buckets.find((b) => b.gradient_pct === 0);
  assert.ok(flat, "deve esserci il bucket 0%");
  // Σv²/Σv = (200·16 + 100·100)/(200·4 + 100·10) ≈ 7.33 m/s, ben sopra la mediana 4.
  assert.ok(flat!.velocity_ms > 6, `media pesata troppo bassa: ${flat!.velocity_ms} m/s`);
});

test("FIX bias: i secondi sotto 1.0 m/s (soste) sono esclusi", () => {
  const streams = variableStreams(0, [
    { v: 0.3, n: 200 }, // soste/coda: da escludere
    { v: 6, n: 200 },
  ]);
  const buckets = buildSignatureFromStreams(streams, 3000);
  const flat = buckets.find((b) => b.gradient_pct === 0);
  assert.ok(flat, "deve esserci il bucket 0%");
  // Restano solo i 6 m/s: la velocità non è trascinata giù dalle soste.
  assert.ok(flat!.velocity_ms > 5, `soste non escluse: ${flat!.velocity_ms} m/s`);
});

test("buildSignatureFromStreams: salita costante → bucket giusto e affidabile", () => {
  const buckets = buildSignatureFromStreams(constantStreams(5, 0.05, 300), 1500);
  const b = buckets.find((x) => x.gradient_pct === 5);
  assert.ok(b, "deve esserci il bucket a 5%");
  assert.equal(Math.round(b!.velocity_ms), 5);
  assert.ok(b!.sample_count >= 120 && b!.reliable, "≥120 campioni → affidabile");
});

test("buildAthleteSignature: dati ricchi MTB → livello 1", async () => {
  // Tre uscite a pendenza costante (flat, salita, discesa): ogni fascia
  // osservata supera i 120 s → copertura 100% → firma personale.
  const activities: ActivityMeta[] = [
    { id: "flat", type: "MountainBikeRide", moving_time: 3600, distance: 15000 },
    { id: "up", type: "MountainBikeRide", moving_time: 3600, distance: 9000 },
    { id: "down", type: "MountainBikeRide", moving_time: 3600, distance: 18000 },
  ];
  const streamsById: Record<string, ActivityStream[]> = {
    flat: constantStreams(5, 0, 300),
    up: constantStreams(3, 0.08, 300),
    down: constantStreams(7, -0.08, 300),
  };
  const sig = await buildAthleteSignature("u1", activities, async (id) => streamsById[id]);
  assert.equal(sig.level, 1, "copertura alta → personale");
  assert.ok(sig.coverage_pct >= 60);
  assert.equal(sig.activities_used, 3);
});

test("buildAthleteSignature: dati scarsi → livello 2 (archetipo merge)", async () => {
  const activities: ActivityMeta[] = [
    { id: "a1", type: "MountainBikeRide", moving_time: 3600, distance: 5000 },
  ];
  // Solo 100 s: nessuna fascia raggiunge i 120 campioni → non affidabile.
  const sig = await buildAthleteSignature("u1", activities, async () =>
    constantStreams(5, 0.05, 100)
  );
  assert.equal(sig.level, 2, "copertura bassa → archetipo");
  assert.ok(sig.buckets.length >= 16, "i bucket includono il seed");
});

test("buildAthleteSignature: ignora attività non-MTB e brevi", async () => {
  const activities: ActivityMeta[] = [
    { id: "r1", type: "Ride", moving_time: 7200, distance: 50000 },
    { id: "short", type: "MountainBikeRide", moving_time: 600, distance: 5000 },
  ];
  const sig = await buildAthleteSignature("u1", activities, async () => mixedStreams());
  assert.equal(sig.activities_used, 0, "nessuna MTB valida usata");
  assert.equal(sig.level, 2);
});

test("estimateSegmentVelocity: bucket affidabile → L1", () => {
  const sig: VelocitySignature = {
    athlete_id: "u1",
    built_at: "",
    activities_used: 3,
    total_samples: 1000,
    buckets: [{ gradient_pct: 5, velocity_ms: 4, sample_count: 300, reliable: true }],
    level: 1,
    coverage_pct: 100,
  };
  const r = estimateSegmentVelocity(0.05, sig, 1.0, CP, WEIGHT);
  assert.equal(r.source, "L1");
  assert.equal(r.velocity_ms, 4);
});

test("estimateSegmentVelocity: salita senza bucket vicino → L3 fisica", () => {
  const sig: VelocitySignature = {
    athlete_id: "u1",
    built_at: "",
    activities_used: 3,
    total_samples: 1000,
    buckets: [{ gradient_pct: 5, velocity_ms: 4, sample_count: 300, reliable: true }],
    level: 1,
    coverage_pct: 100,
  };
  // 12% è lontano dal bucket 5% (>3.75%) → fisica pura in salita.
  const r = estimateSegmentVelocity(0.12, sig, 1.0, CP, WEIGHT);
  assert.equal(r.source, "L3");
});

test("estimateSegmentVelocity: piano senza bucket → L2 archetipo", () => {
  const sig = archetypeSignature("u1");
  // archetipo ha tutte le fasce reliable → L2
  const r = estimateSegmentVelocity(0.0, sig, 1.0, CP, WEIGHT);
  assert.equal(r.source, "L2");
  assert.ok(r.velocity_ms > 0);
});

// --- TerrainSummary sintetico per gli scenari -------------------------------

function makeTerrain(distanceKm: number, eleAt: (km: number) => number): TerrainSummary {
  const polyline: Array<[number, number, number, number]> = [];
  const steps = Math.round(distanceKm / 0.5);
  for (let i = 0; i <= steps; i++) {
    const km = i * 0.5;
    polyline.push([Number(km.toFixed(2)), 45, 7, Math.round(eleAt(km))]);
  }
  return {
    total_distance_km: distanceKm,
    total_elevation_m: 1000,
    elevation_per_km: 20,
    course_character: "mountain",
    climbs: [],
    descents: [],
    polyline,
  };
}

test("estimateRaceTimeV2: scenari ordinati conservativo ≥ realistico ≥ ottimistico", () => {
  const sig = archetypeSignature("u1");
  const terrain = makeTerrain(40, (km) => 200 + 150 * Math.sin((km / 40) * Math.PI * 4));
  const opt = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "optimistic");
  const real = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic");
  const cons = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "conservative");
  assert.ok(cons.total_seconds >= real.total_seconds);
  assert.ok(real.total_seconds >= opt.total_seconds);
});

test("computeRaceEstimateV2: struttura + breakdown somma ~100% + livello", () => {
  const sig = archetypeSignature("u1");
  const terrain = makeTerrain(88, (km) => 300 + 200 * Math.sin((km / 88) * Math.PI * 10));
  const est = computeRaceEstimateV2(terrain, sig, CP, WEIGHT, 45);
  assert.equal(est.signature_level, 2);
  assert.ok(est.scenarios.realistic.segments.length > 10);
  const { L1, L2, L3 } = est.source_breakdown;
  assert.ok(Math.abs(L1 + L2 + L3 - 100) <= 1, "le fonti coprono ~100%");
});

test("validateAgainstKnown: archetipo stima il Rampichilonero entro ±20%", () => {
  const v = validateAgainstKnown();
  assert.ok(
    Math.abs(v.error_pct) < 20,
    `errore archetipo ${v.error_pct}% deve stare entro ±20% (reale 3h08)`
  );
});
