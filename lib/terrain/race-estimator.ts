import type { ClimbCategory, TerrainSummary } from "@/lib/terrain/gpx-parser";

/**
 * Stima tempi e pacing gara (PRD §33) — funzioni PURE, nessuna API, nessuna AI.
 *
 * Modello fisico per MTB: potenza disponibile (dalla CP, scalata per la fatica)
 * contro gravità, rotolamento e aerodinamica, segmento per segmento sulla
 * polyline del percorso. I parametri MTB (CRR, CDA, cap discesa) sono già
 * ottimistici per fuoristrada e NON vanno cambiati senza fonte.
 */

// --- Costanti MTB (NON modificare senza fonte) -------------------------------

const GRAVITY = 9.81;
const CRR = 0.02; // rolling resistance MTB (road ≈ 0.004)
const CDA = 0.6; // area aerodinamica MTB posizione normale (m²)
const RHO = 1.2; // densità aria (kg/m³)
const MAX_DESCENT_KMH = 40; // cap velocità in discesa su MTB tecnico
const STOP_TIME_MIN = 15; // soste/rifornimenti stimati

/** Velocità minima fisica (m/s) anche in salita ripida: 5.4 km/h. */
const MIN_SPEED_MPS = 1.5;
/** Sopra questa pendenza l'aerodinamica è trascurabile (approx. lineare). */
const STEEP_GRADIENT = 0.03;

export type Scenario = "optimistic" | "realistic" | "conservative";

export interface RaceSegment {
  km: number;
  gradient_pct: number;
  power_w: number;
  speed_kmh: number;
  cumulative_time_min: number;
}

export interface RaceTimeEstimate {
  scenario: Scenario;
  total_seconds: number;
  moving_seconds: number;
  avg_speed_kmh: number;
  segments: RaceSegment[];
}

export interface KeySplit {
  climb_ref: number;
  top_km: number;
  category: ClimbCategory;
  distance_km: number;
  elevation_m: number;
  avg_gradient_pct: number;
  eta_seconds: number | null;
  eta_formatted: string;
}

export interface PacingAdvice {
  label: string; // "inizio" | "metà" | "finale"
  from_km: number;
  to_km: number;
  target_wkg: number | null;
  avg_speed_kmh: number | null;
}

export interface PacingPlan {
  finish_range: string;
  finish_realistic: string;
  key_splits: KeySplit[];
  pacing_advice: PacingAdvice[];
  warning: string | null;
}

export interface RaceEstimate {
  cp_w: number;
  weight_kg: number;
  scenarios: {
    optimistic: Omit<RaceTimeEstimate, "segments">;
    realistic: RaceTimeEstimate; // mantiene i segmenti per il grafico pacing
    conservative: Omit<RaceTimeEstimate, "segments">;
  };
  pacing: PacingPlan;
}

// --- solveVelocity -----------------------------------------------------------

/**
 * Risolve P = m·g·v·(grad + CRR) + ½·CDA·RHO·v³ per v (m/s).
 * Salita (>3%): aero trascurabile → forma lineare. Altrove (flat/discesa):
 * Newton sulla cubica (3 iterazioni). Clamp: min 1.5 m/s; in discesa cap a
 * MAX_DESCENT_KMH. `cda`/`crr` opzionali (default alle costanti MTB storiche)
 * per i chiamanti che vogliono parametrizzare posizione/fondo (Race Planner M1).
 */
export function solveVelocity(
  powerW: number,
  massKg: number,
  gradientFrac: number,
  cda: number = CDA,
  crr: number = CRR
): number {
  const resistive = massKg * GRAVITY * (gradientFrac + crr);
  let v: number;

  if (gradientFrac > STEEP_GRADIENT) {
    // Termine aerodinamico trascurabile in salita MTB.
    v = resistive > 0 ? powerW / resistive : MIN_SPEED_MPS;
  } else {
    // Newton su f(v) = ½·CDA·RHO·v³ + resistive·v − P.
    v = 6; // guess iniziale ragionevole (flat/discesa)
    for (let i = 0; i < 3; i++) {
      const f = 0.5 * cda * RHO * v ** 3 + resistive * v - powerW;
      const fp = 1.5 * cda * RHO * v ** 2 + resistive;
      if (fp === 0) break;
      v = v - f / fp;
    }
  }

  if (!Number.isFinite(v) || v < MIN_SPEED_MPS) v = MIN_SPEED_MPS;
  // Cap discesa: la fisica può dare velocità irreali su MTB tecnico.
  if (gradientFrac < 0) v = Math.min(v, MAX_DESCENT_KMH / 3.6);
  return v;
}

// --- fatigueMultiplier -------------------------------------------------------

/**
 * Decadimento di potenza per posizione nel percorso (stesso spirito di
 * gap-analysis, a 4 fasce). ctlToday è riservato a calibrazioni future.
 */
export function fatigueMultiplier(
  positionKm: number,
  totalKm: number,
  ctlToday: number | null
): number {
  void ctlToday; // riservato: il decadimento v0 dipende solo dalla posizione
  const frac = totalKm > 0 ? Math.min(1, Math.max(0, positionKm / totalKm)) : 0;
  if (frac < 0.3) return 1.0;
  if (frac < 0.6) return 0.95;
  if (frac < 0.8) return 0.88;
  return 0.82;
}

// --- estimateRaceTime --------------------------------------------------------

/** "Xh YYmin" da secondi. */
function formatHm(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}min`;
}

export function estimateRaceTime(
  terrain: TerrainSummary,
  cpW: number,
  weightKg: number,
  ctlToday: number | null,
  scenario: Scenario
): RaceTimeEstimate {
  const poly = terrain.polyline;
  const totalKm = poly.length > 0 ? poly[poly.length - 1][0] : 0;

  let moving = 0;
  const segments: RaceSegment[] = [];

  for (let i = 0; i < poly.length - 1; i++) {
    const km = poly[i][0];
    const deltaDist = (poly[i + 1][0] - km) * 1000;
    if (deltaDist <= 0) continue;
    const gradient = (poly[i + 1][3] - poly[i][3]) / deltaDist;

    let power = cpW;
    if (scenario !== "optimistic") {
      power = cpW * fatigueMultiplier(km, totalKm, ctlToday);
      if (scenario === "conservative") power *= 0.85;
    }

    const v = solveVelocity(power, weightKg, gradient);
    moving += deltaDist / v;

    segments.push({
      km: Number(km.toFixed(1)),
      gradient_pct: Number((gradient * 100).toFixed(1)),
      power_w: Math.round(power),
      speed_kmh: Number((v * 3.6).toFixed(1)),
      cumulative_time_min: Number((moving / 60).toFixed(1)),
    });
  }

  const total = moving + STOP_TIME_MIN * 60;
  const avg_speed_kmh =
    moving > 0 ? Number((totalKm / (moving / 3600)).toFixed(1)) : 0;

  return {
    scenario,
    total_seconds: Math.round(total),
    moving_seconds: Math.round(moving),
    avg_speed_kmh,
    segments,
  };
}

// --- buildPacingPlan ---------------------------------------------------------

/** Segmento realistico più vicino a una certa progressiva (km). */
function nearestSegment(
  segments: RaceSegment[],
  km: number
): RaceSegment | null {
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

export function buildPacingPlan(
  estimates: {
    optimistic: RaceTimeEstimate;
    realistic: RaceTimeEstimate;
    conservative: RaceTimeEstimate;
  },
  terrain: TerrainSummary,
  weightKg: number
): PacingPlan {
  const { optimistic, realistic, conservative } = estimates;
  const segs = realistic.segments;
  const totalKm = terrain.total_distance_km;

  // Split sulle salite: tempo di arrivo in cima dallo scenario realistico.
  const key_splits: KeySplit[] = terrain.climbs.map((climb) => {
    const topKm = climb.position_km + climb.distance_km;
    const seg = nearestSegment(segs, topKm);
    const eta_seconds = seg != null ? Math.round(seg.cumulative_time_min * 60) : null;
    return {
      climb_ref: climb.position_km,
      top_km: Number(topKm.toFixed(1)),
      category: climb.category,
      distance_km: climb.distance_km,
      elevation_m: climb.elevation_m,
      avg_gradient_pct: climb.avg_gradient_pct,
      eta_seconds,
      eta_formatted: eta_seconds != null ? formatHm(eta_seconds) : "—",
    };
  });

  // Consigli per terzo di percorso (media potenza/velocità nel tratto).
  const thirds: Array<{ label: string; from: number; to: number }> = [
    { label: "inizio", from: 0, to: totalKm / 3 },
    { label: "metà", from: totalKm / 3, to: (2 * totalKm) / 3 },
    { label: "finale", from: (2 * totalKm) / 3, to: totalKm },
  ];
  const pacing_advice: PacingAdvice[] = thirds.map(({ label, from, to }) => {
    const inRange = segs.filter((s) => s.km >= from && s.km < to);
    const list = inRange.length > 0 ? inRange : segs;
    const avgPower =
      list.reduce((sum, s) => sum + s.power_w, 0) / Math.max(1, list.length);
    const avgSpeed =
      list.reduce((sum, s) => sum + s.speed_kmh, 0) / Math.max(1, list.length);
    return {
      label,
      from_km: Number(from.toFixed(1)),
      to_km: Number(to.toFixed(1)),
      target_wkg: weightKg > 0 ? Number((avgPower / weightKg).toFixed(2)) : null,
      avg_speed_kmh: Number(avgSpeed.toFixed(1)),
    };
  });

  const conservativeHours = conservative.total_seconds / 3600;
  // Euristica v0: oltre le 8h, suggerisci un blocco di preparazione.
  const weeks = Math.min(20, 8 + Math.ceil(Math.max(0, conservativeHours - 8)) * 2);
  const warning =
    conservativeHours > 8
      ? `Lo scenario conservativo supera le 8h: considera un piano di allenamento di almeno ${weeks} settimane per arrivare pronto.`
      : null;

  return {
    finish_range: `${formatHm(conservative.total_seconds)} — ${formatHm(optimistic.total_seconds)}`,
    finish_realistic: formatHm(realistic.total_seconds),
    key_splits,
    pacing_advice,
    warning,
  };
}

// --- computeRaceEstimate (orchestratore, usato dalle route) ------------------

function stripSegments(e: RaceTimeEstimate): Omit<RaceTimeEstimate, "segments"> {
  const { segments: _segments, ...rest } = e;
  void _segments;
  return rest;
}

/**
 * Calcola i tre scenari + il piano di pacing in un colpo solo. Usato sia dalla
 * route /race-estimate (bottone "Aggiorna stima") sia dalla /gap-analysis
 * (aggiornamento automatico dopo una nuova analisi evento).
 */
export function computeRaceEstimate(
  terrain: TerrainSummary,
  cpW: number,
  weightKg: number,
  ctlToday: number | null
): RaceEstimate {
  const optimistic = estimateRaceTime(terrain, cpW, weightKg, ctlToday, "optimistic");
  const realistic = estimateRaceTime(terrain, cpW, weightKg, ctlToday, "realistic");
  const conservative = estimateRaceTime(terrain, cpW, weightKg, ctlToday, "conservative");

  const pacing = buildPacingPlan(
    { optimistic, realistic, conservative },
    terrain,
    weightKg
  );

  return {
    cp_w: cpW,
    weight_kg: weightKg,
    scenarios: {
      optimistic: stripSegments(optimistic),
      realistic, // con segmenti, per il grafico
      conservative: stripSegments(conservative),
    },
    pacing,
  };
}
