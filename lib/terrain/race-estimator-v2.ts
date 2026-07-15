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

import type { Climb, TerrainSummary } from "@/lib/terrain/gpx-parser";
import {
  buildPacingPlan,
  fatigueMultiplier,
  type RaceEstimate,
  type RaceSegment,
  type RaceTimeEstimate,
  type Scenario,
} from "@/lib/terrain/race-estimator";
import type { RaceEstimateOpts, SurfaceKey } from "@/lib/terrain/route-settings";
import {
  DEFAULT_SURFACE,
  SIGNATURE_REF_BIKE_KG,
  SIGNATURE_REF_CRR,
  massFactor,
  surfaceFactor,
} from "@/lib/terrain/route-settings";
import {
  physicsVelocity,
  seedBucketFor,
  type VelocitySignature,
} from "@/lib/terrain/velocity-signature";

export type { RaceEstimateOpts } from "@/lib/terrain/route-settings";

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
  /** Dettaglio per-salita (Race Planner M1), dallo scenario realistico. */
  climb_estimates: ClimbEstimate[];
  /** Peso bici usato nella stima (kg), 0 se non impostato. */
  bike_weight_kg: number;
  /** Margine di ripetibilità applicato (moltiplicatore potenza globale), per il <details>. */
  repeatability_frac: number;
}

/** Dettaglio di una singola salita nello scenario realistico (Race Planner M1). */
export interface ClimbEstimate {
  index: number; // indice in terrain.climbs
  name: string; // "Salita N" (N = index+1)
  position_km: number;
  distance_km: number;
  elevation_m: number;
  avg_gradient_pct: number;
  max_elevation_m: number; // quota max = ele di fine salita dalla polyline
  power_w: number; // P target medio nel tratto salita (realistic)
  pct_cp: number | null; // power_w / cp_w * 100 (null se cp_w<=0)
  wkg: number | null; // power_w / weightKg atleta (null se weightKg<=0)
  eta_seconds: number | null; // tempo cumulato a fine salita (realistic)
  time_on_climb_s: number; // durata solo del tratto salita
  avg_speed_kmh: number;
  vam_mh: number; // elevation_m / (time_on_climb_s/3600), 0 se tempo 0
  surface: SurfaceKey; // fondo scelto
}

/**
 * Indice della salita (in `climbs`) che contiene `km`, o -1 se `km` non cade
 * in nessuna salita. Le salite non si sovrappongono (da detectClimbs).
 */
function climbIndexAtKm(climbs: Climb[], km: number): number {
  for (let i = 0; i < climbs.length; i++) {
    const climb = climbs[i];
    if (km >= climb.position_km && km <= climb.position_km + climb.distance_km) {
      return i;
    }
  }
  return -1;
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
 * (approssimazione valida soprattutto in salita). `massTotalKg` è atleta+bici;
 * `cda`/`crr` opzionali propagati al ramo L3 (fisica pura, Race Planner M1).
 * `bikeWeightKg` (M1.2) corregge anche il ramo L1/L2 per peso bici diverso dal
 * riferimento della firma (`SIGNATURE_REF_BIKE_KG`); undefined/0 → nessuna
 * correzione (retro-compat).
 */
export function estimateSegmentVelocity(
  gradientFrac: number,
  signature: VelocitySignature,
  powerFraction: number,
  cpW: number,
  massTotalKg: number,
  cda?: number,
  crr?: number,
  bikeWeightKg?: number
): { velocity_ms: number; source: VelocitySource } {
  const pct = gradientFrac * 100;
  const near = nearestBucket(signature, pct);

  // L1/L2: bucket affidabile e abbastanza vicino alla fascia target.
  if (near && near.bucket.reliable && near.diff <= NEAR_PCT && near.bucket.velocity_ms > 0) {
    const surfFactor =
      crr != null && gradientFrac > STEEP_GRADIENT
        ? surfaceFactor(gradientFrac, SIGNATURE_REF_CRR, crr)
        : 1;
    const massFac =
      bikeWeightKg != null && bikeWeightKg > 0 && gradientFrac > STEEP_GRADIENT
        ? massFactor(massTotalKg - bikeWeightKg + SIGNATURE_REF_BIKE_KG, massTotalKg)
        : 1;
    const v = Math.max(
      MIN_SPEED_MPS,
      near.bucket.velocity_ms * powerFraction * surfFactor * massFac
    );
    return { velocity_ms: v, source: signature.level === 1 ? "L1" : "L2" };
  }

  // L3: fisica pura, solo in salita (dove è accurata).
  if (gradientFrac > STEEP_GRADIENT) {
    return {
      velocity_ms: physicsVelocity(gradientFrac, cpW, massTotalKg, powerFraction, cda, crr),
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
  ctlToday: number | null,
  repeatabilityFrac: number
): number {
  if (scenario === "optimistic") return 1.0 * repeatabilityFrac;
  const fatigue = fatigueMultiplier(km, totalKm, ctlToday);
  const base = scenario === "conservative" ? fatigue * 0.85 : fatigue;
  return base * repeatabilityFrac;
}

export function estimateRaceTimeV2(
  terrain: TerrainSummary,
  signature: VelocitySignature,
  cpW: number,
  weightKg: number,
  ctlToday: number | null,
  scenario: Scenario,
  opts?: RaceEstimateOpts
): RaceTimeEstimateV2 {
  const poly = terrain.polyline;
  const totalKm = poly.length > 0 ? poly[poly.length - 1][0] : 0;
  const climbs = terrain.climbs;

  const cdaM2 = opts?.cda_m2;
  const bikeWeightKg = opts?.bike_weight_kg ?? 0;
  const repeatabilityFrac = opts?.repeatability_frac ?? 1.0;
  const climbCrr = opts?.climb_crr;
  const massTotalKg = weightKg + bikeWeightKg;

  let moving = 0;
  const segments: RaceSegment[] = [];
  const source_dist_m: Record<VelocitySource, number> = { L1: 0, L2: 0, L3: 0 };

  for (let i = 0; i < poly.length - 1; i++) {
    const km = poly[i][0];
    const deltaDist = (poly[i + 1][0] - km) * 1000;
    if (deltaDist <= 0) continue;
    const gradient = (poly[i + 1][3] - poly[i][3]) / deltaDist;

    const powerFraction = powerFractionFor(scenario, km, totalKm, ctlToday, repeatabilityFrac);
    // Crr per-salita: solo dentro il tratto della salita (fuori è irrilevante, niente L3).
    const climbIdx = climbCrr ? climbIndexAtKm(climbs, km) : -1;
    const crr = climbIdx >= 0 ? climbCrr![climbIdx] : undefined;
    const { velocity_ms, source } = estimateSegmentVelocity(
      gradient,
      signature,
      powerFraction,
      cpW,
      massTotalKg,
      cdaM2,
      crr,
      bikeWeightKg
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
 * Dettaglio per-salita (Race Planner M1), aggregando i segmenti già calcolati
 * dello scenario realistico che cadono nel tratto [position_km, position_km +
 * distance_km] di ciascuna salita. Nessuna nuova fisica: solo aggregazione.
 * `power_w`/`speed_kmh` sono medie sui segmenti del tratto; `eta_seconds` è il
 * tempo cumulato al segmento più vicino alla cima (stessa logica di
 * nearestSegment/key_splits in buildPacingPlan). Guardie divisione per zero
 * per VAM/velocità quando il tratto degenera (0 segmenti o tempo 0).
 */
function buildClimbEstimates(
  climbs: TerrainSummary["climbs"],
  realistic: RaceTimeEstimateV2,
  polyline: TerrainSummary["polyline"],
  cpW: number,
  weightKg: number,
  opts?: RaceEstimateOpts
): ClimbEstimate[] {
  const segs = realistic.segments;

  return climbs.map((climb, index) => {
    const topKm = climb.position_km + climb.distance_km;
    const inClimb = segs.filter((s) => s.km >= climb.position_km && s.km <= topKm);

    const avgPowerW =
      inClimb.length > 0
        ? inClimb.reduce((sum, s) => sum + s.power_w, 0) / inClimb.length
        : 0;
    const avgSpeedKmh =
      inClimb.length > 0
        ? inClimb.reduce((sum, s) => sum + s.speed_kmh, 0) / inClimb.length
        : 0;

    // Tempo sul tratto: differenza tra il tempo cumulato all'ultimo e al primo
    // segmento del tratto (approssima l'ingresso in salita). Fallback dalla
    // distanza/velocità media se meno di 2 segmenti cadono nel tratto.
    let timeOnClimbS = 0;
    if (inClimb.length >= 2) {
      timeOnClimbS = Math.max(
        0,
        (inClimb[inClimb.length - 1].cumulative_time_min - inClimb[0].cumulative_time_min) * 60
      );
    } else if (avgSpeedKmh > 0) {
      timeOnClimbS = (climb.distance_km / avgSpeedKmh) * 3600;
    }

    const nearestTop = nearestSegmentByKm(segs, topKm);
    const etaSeconds = nearestTop != null ? Math.round(nearestTop.cumulative_time_min * 60) : null;

    // Quota max = elevazione del punto di polyline più vicino alla cima.
    const topPoint = nearestPolylinePoint(polyline, topKm);
    const maxElevationM = topPoint != null ? topPoint[3] : 0;

    const vamMh = timeOnClimbS > 0 ? (climb.elevation_m / (timeOnClimbS / 3600)) : 0;

    return {
      index,
      name: `Salita ${index + 1}`,
      position_km: climb.position_km,
      distance_km: climb.distance_km,
      elevation_m: climb.elevation_m,
      avg_gradient_pct: climb.avg_gradient_pct,
      max_elevation_m: maxElevationM,
      power_w: Math.round(avgPowerW),
      pct_cp: cpW > 0 ? Number(((avgPowerW / cpW) * 100).toFixed(1)) : null,
      wkg: weightKg > 0 ? Number((avgPowerW / weightKg).toFixed(2)) : null,
      eta_seconds: etaSeconds,
      time_on_climb_s: Math.round(timeOnClimbS),
      avg_speed_kmh: Number(avgSpeedKmh.toFixed(1)),
      vam_mh: Math.round(vamMh),
      surface: opts?.climb_surface?.[index] ?? DEFAULT_SURFACE,
    };
  });
}

/** Segmento realistico più vicino a una progressiva (km). Stessa logica di nearestSegment (v1). */
function nearestSegmentByKm(segments: RaceSegment[], km: number): RaceSegment | null {
  let best: RaceSegment | null = null;
  let bestDiff = Infinity;
  for (const s of segments) {
    const diff = Math.abs(s.km - km);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

/** Punto di polyline più vicino a una progressiva (km). */
function nearestPolylinePoint(
  polyline: TerrainSummary["polyline"],
  km: number
): TerrainSummary["polyline"][number] | null {
  let best: TerrainSummary["polyline"][number] | null = null;
  let bestDiff = Infinity;
  for (const p of polyline) {
    const diff = Math.abs(p[0] - km);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p;
    }
  }
  return best;
}

/**
 * Tre scenari + pacing, con la firma di velocità. Stessa forma di
 * computeRaceEstimate v1, più source_breakdown e signature_level per la UI.
 * `opts` (Race Planner M1, opzionale) parametrizza CdA/peso bici/margine di
 * ripetibilità/Crr-per-salita; senza opts il comportamento è quello storico.
 */
export function computeRaceEstimateV2(
  terrain: TerrainSummary,
  signature: VelocitySignature,
  cpW: number,
  weightKg: number,
  ctlToday: number | null,
  opts?: RaceEstimateOpts
): RaceEstimateV2 {
  const optimistic = estimateRaceTimeV2(terrain, signature, cpW, weightKg, ctlToday, "optimistic", opts);
  const realistic = estimateRaceTimeV2(terrain, signature, cpW, weightKg, ctlToday, "realistic", opts);
  const conservative = estimateRaceTimeV2(terrain, signature, cpW, weightKg, ctlToday, "conservative", opts);

  // buildPacingPlan riceve weightKg ATLETA (non +bici), così i W/kg restano onesti.
  const pacing = buildPacingPlan({ optimistic, realistic, conservative }, terrain, weightKg);

  const climbEstimates = buildClimbEstimates(
    terrain.climbs,
    realistic,
    terrain.polyline,
    cpW,
    weightKg,
    opts
  );

  return {
    cp_w: cpW,
    weight_kg: weightKg,
    scenarios: {
      optimistic: stripSegments(optimistic),
      realistic, // con segmenti per il grafico
      conservative: stripSegments(conservative),
    },
    pacing,
    climb_estimates: climbEstimates,
    bike_weight_kg: opts?.bike_weight_kg ?? 0,
    repeatability_frac: opts?.repeatability_frac ?? 1.0,
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
