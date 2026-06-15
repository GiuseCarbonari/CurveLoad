/**
 * Stima tempi gara v2 — modello a 3 livelli (M7) — funzioni PURE, nessuna AI.
 *
 * SOSTITUISCE il calcolo della velocità di race-estimator.ts (la fisica pura
 * era accurata SOLO in salita, vedi docs/CALIBRATION_NOTES.md). Qui la
 * velocità di ogni segmento viene da:
 *   L1 — firma personale dell'atleta (fascia di pendenza affidabile);
 *   L2 — archetipo MTB ancorato a dati reali (firma livello 2 o seed);
 *   L3 — fisica pura, solo in salita (>3%) quando manca un bucket affidabile.
 *
 * Riusa `fatigueMultiplier` (già validato) e `buildPacingPlan` di v1, e la
 * stessa struttura di output (RaceTimeEstimate/RaceEstimate) così la Ui
 * esistente (RaceEstimateView) funziona invariata.
 */

import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import {
  buildPacingPlan,
  fatigueMultiplier,
  type RaceEstimate,
  type RaceSegment,
  type RaceTimeEstimate,
  type Scenario,
} from "@/lib/terrain/race-estimator";
import {
  physicsVelocity,
  seedBucketFor,
  type VelocitySignature,
} from "@/lib/terrain/velocity-signature";

/** Soste/rifornimenti stimati (come v1). */
const STOP_TIME_MIN = 15;
/** Velocità minima fisica (m/s). */
const MIN_SPEED_MPS = 1.5;
/** Una fascia personale è accettata solo se entro 3.75% (1.5 step) dal target. */
const NEAR_PCT = 3.75;
/** Sopra questa pendenza la fisica pura (L3) è affidabile. */
const STEEP_GRADIENT = 0.03;

export type VelocitySource = "L1" | "L2" | "L3";

export interface SourceBreakdown {
  /** % di DISTANZA stimata con ciascun livello. */
  L1: number;
  L2: number;
  L3: number;
}

export interface RaceEstimateV2 extends RaceEstimate {
  source_breakdown: SourceBreakdown;
  signature_level: 1 | 2;
  /** Quante attività MTB hanno alimentato la firma (0 per solo archetipo). */
  activities_used: number;
  /** % di fasce osservate affidabili (dalla firma). */
  coverage_pct: number;
}

// --- estimateSegmentVelocity -------------------------------------------------

/** Bucket personale più vicino a `pct`, o null se la firma non ha bucket. */
function nearestBucket(signature: VelocitySignature, pct: number) {
  let best: VelocitySignature["buckets"][number] | null = null;
  let bestDiff = Infinity;
  for (const b of signature.buckets) {
    const diff = Math.abs(b.gradient_pct - pct);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = b;
    }
  }
  return best ? { bucket: best, diff: bestDiff } : null;
}

/**
 * Velocità (m/s) di un segmento alla pendenza data, scegliendo la fonte
 * secondo il modello a 3 livelli. `powerFraction` (0.82–1.0) sconta la
 * potenza per la fatica e si traduce in velocità ridotta proporzionalmente
 * (approssimazione valida soprattutto in salita).
 */
export function estimateSegmentVelocity(
  gradientFrac: number,
  signature: VelocitySignature,
  powerFraction: number,
  cpW: number,
  weightKg: number
): { velocity_ms: number; source: VelocitySource } {
  const pct = gradientFrac * 100;
  const near = nearestBucket(signature, pct);

  // L1/L2: bucket affidabile e abbastanza vicino alla fascia target.
  if (near && near.bucket.reliable && near.diff <= NEAR_PCT && near.bucket.velocity_ms > 0) {
    const v = Math.max(MIN_SPEED_MPS, near.bucket.velocity_ms * powerFraction);
    return { velocity_ms: v, source: signature.level === 1 ? "L1" : "L2" };
  }

  // L3: fisica pura, solo in salita (dove è accurata).
  if (gradientFrac > STEEP_GRADIENT) {
    return {
      velocity_ms: physicsVelocity(gradientFrac, cpW, weightKg, powerFraction),
      source: "L3",
    };
  }

  // L2: archetipo per la fascia (piano/discesa senza bucket affidabile).
  const seed = seedBucketFor(gradientFrac);
  return {
    velocity_ms: Math.max(MIN_SPEED_MPS, seed.velocity_ms * powerFraction),
    source: "L2",
  };
}

// --- estimateRaceTimeV2 ------------------------------------------------------

interface RaceTimeEstimateV2 extends RaceTimeEstimate {
  /** Distanza (m) attribuita a ciascuna fonte, per il breakdown. */
  source_dist_m: Record<VelocitySource, number>;
}

function powerFractionFor(
  scenario: Scenario,
  km: number,
  totalKm: number,
  ctlToday: number | null
): number {
  if (scenario === "optimistic") return 1.0;
  const fatigue = fatigueMultiplier(km, totalKm, ctlToday);
  return scenario === "conservative" ? fatigue * 0.85 : fatigue;
}

export function estimateRaceTimeV2(
  terrain: TerrainSummary,
  signature: VelocitySignature,
  cpW: number,
  weightKg: number,
  ctlToday: number | null,
  scenario: Scenario
): RaceTimeEstimateV2 {
  const poly = terrain.polyline;
  const totalKm = poly.length > 0 ? poly[poly.length - 1][0] : 0;

  let moving = 0;
  const segments: RaceSegment[] = [];
  const source_dist_m: Record<VelocitySource, number> = { L1: 0, L2: 0, L3: 0 };

  for (let i = 0; i < poly.length - 1; i++) {
    const km = poly[i][0];
    const deltaDist = (poly[i + 1][0] - km) * 1000;
    if (deltaDist <= 0) continue;
    const gradient = (poly[i + 1][3] - poly[i][3]) / deltaDist;

    const powerFraction = powerFractionFor(scenario, km, totalKm, ctlToday);
    const { velocity_ms, source } = estimateSegmentVelocity(
      gradient,
      signature,
      powerFraction,
      cpW,
      weightKg
    );
    moving += deltaDist / velocity_ms;
    source_dist_m[source] += deltaDist;

    segments.push({
      km: Number(km.toFixed(1)),
      gradient_pct: Number((gradient * 100).toFixed(1)),
      // Potenza informativa (il driver è la velocità appresa, non la potenza).
      power_w: Math.round(cpW * powerFraction),
      speed_kmh: Number((velocity_ms * 3.6).toFixed(1)),
      cumulative_time_min: Number((moving / 60).toFixed(1)),
    });
  }

  const total = moving + STOP_TIME_MIN * 60;
  const avg_speed_kmh = moving > 0 ? Number((totalKm / (moving / 3600)).toFixed(1)) : 0;

  return {
    scenario,
    total_seconds: Math.round(total),
    moving_seconds: Math.round(moving),
    avg_speed_kmh,
    segments,
    source_dist_m,
  };
}

// --- computeRaceEstimateV2 (orchestratore) -----------------------------------

function stripSegments(e: RaceTimeEstimate): Omit<RaceTimeEstimate, "segments"> {
  const { segments: _segments, ...rest } = e;
  void _segments;
  return rest;
}

function breakdownFrom(dist: Record<VelocitySource, number>): SourceBreakdown {
  const total = dist.L1 + dist.L2 + dist.L3;
  if (total <= 0) return { L1: 0, L2: 0, L3: 0 };
  return {
    L1: Math.round((dist.L1 / total) * 100),
    L2: Math.round((dist.L2 / total) * 100),
    L3: Math.round((dist.L3 / total) * 100),
  };
}

/**
 * Tre scenari + pacing, con la firma di velocità. Stessa forma di
 * computeRaceEstimate v1, più source_breakdown e signature_level per la UI.
 */
export function computeRaceEstimateV2(
  terrain: TerrainSummary,
  signature: VelocitySignature,
  cpW: number,
  weightKg: number,
  ctlToday: number | null
): RaceEstimateV2 {
  const optimistic = estimateRaceTimeV2(terrain, signature, cpW, weightKg, ctlToday, "optimistic");
  const realistic = estimateRaceTimeV2(terrain, signature, cpW, weightKg, ctlToday, "realistic");
  const conservative = estimateRaceTimeV2(terrain, signature, cpW, weightKg, ctlToday, "conservative");

  const pacing = buildPacingPlan({ optimistic, realistic, conservative }, terrain, weightKg);

  return {
    cp_w: cpW,
    weight_kg: weightKg,
    scenarios: {
      optimistic: stripSegments(optimistic),
      realistic, // con segmenti per il grafico
      conservative: stripSegments(conservative),
    },
    pacing,
    source_breakdown: breakdownFrom(realistic.source_dist_m),
    signature_level: signature.level,
    activities_used: signature.activities_used,
    coverage_pct: signature.coverage_pct,
  };
}

// --- validateAgainstKnown (calibrazione, non bloccante) ----------------------

export interface KnownValidation {
  course: string;
  estimated_moving_s: number;
  estimated_moving_formatted: string;
  real_moving_s: number;
  real_moving_formatted: string;
  error_pct: number;
}

/**
 * Stima il tempo del Rampichilonero con l'ARCHETYPE_SEED e lo confronta col
 * reale verificato (3h08 = 11288 s mov). Usa la distribuzione per fascia
 * documentata (CALIBRATION_NOTES.md), mappando ogni banda a una pendenza
 * rappresentativa. Risultato a fini di calibrazione, NON bloccante.
 */
export function validateAgainstKnown(): KnownValidation {
  // Distribuzione reale per banda (km) e pendenza rappresentativa (frazione).
  const bands: Array<{ dist_km: number; rep_grad: number }> = [
    { dist_km: 16.43, rep_grad: -0.1 }, // discesa <−3%
    { dist_km: 1.39, rep_grad: -0.025 }, // discesa dolce
    { dist_km: 6.81, rep_grad: 0.0 }, // pianeggiante
    { dist_km: 2.5, rep_grad: 0.025 }, // salita dolce
    { dist_km: 17.3, rep_grad: 0.1 }, // salita (≈9% medio, 1558 m / 17.3 km)
  ];

  let moving = 0;
  for (const b of bands) {
    const v = seedBucketFor(b.rep_grad).velocity_ms; // m/s
    moving += (b.dist_km * 1000) / v;
  }

  const real = 11288;
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return `${h}h ${m.toString().padStart(2, "0")}min`;
  };

  return {
    course: "Rampichilonero 2024 (43.44 km / 1558 m D+)",
    estimated_moving_s: Math.round(moving),
    estimated_moving_formatted: fmt(moving),
    real_moving_s: real,
    real_moving_formatted: fmt(real),
    error_pct: Number((((moving - real) / real) * 100).toFixed(1)),
  };
}
