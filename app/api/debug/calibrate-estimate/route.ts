import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { XMLParser } from "fast-xml-parser";

import { detectClimbs, parseGPX } from "@/lib/terrain/gpx-parser";
import { estimateRaceTime, solveVelocity } from "@/lib/terrain/race-estimator";

/**
 * GET /api/debug/calibrate-estimate — SOLO SVILUPPO.
 *
 * Calibrazione del race-estimator su una GARA REALE (Rampiconero 2024) di cui
 * conosciamo tempo, potenza e velocità misurati. NON modifica il modello: è
 * pura DIAGNOSI NUMERICA. Confronta l'output attuale di estimateRaceTime() con
 * la realtà e, soprattutto, isola SU QUALE TERRENO il modello sbaglia di più
 * confrontando — per fasce di gradiente — la velocità reale (dai timestamp del
 * GPX) con la velocità che il modello calcola alla potenza reale media (180 W).
 *
 * Perché 180 W e non la CP? estimateRaceTime gira a potenza ≈ CP·fatica
 * (≫ 180 W reali): confrontando il modello a 180 W separiamo l'errore di
 * TERRENO/FISICA dall'errore di ASSUNZIONE DI POTENZA. Entrambi vengono
 * riportati. In produzione risponde 404. Nessun fix qui: solo numeri.
 */

export const dynamic = "force-dynamic";

// --- Dati reali della gara (input di calibrazione) ---------------------------

const GPX_FILENAME = "Rampiconero_2024.gpx";

const REAL = {
  distance_km: 43.44,
  elevation_m: 1558,
  moving_time_s: 11288, // 3h08
  elapsed_time_s: 12780, // 3h33
  avg_power_w: 180,
  avg_speed_kmh: 13.8,
  ftp_w: 242, // FTP dell'atleta all'epoca → usata come CP del modello
  weight_kg: 76.2,
};

// --- Parametri della diagnosi (dichiarati) -----------------------------------

/** Sotto questa velocità istantanea il punto è "fermo": escluso dal moving. */
const MOVING_MIN_MPS = 0.5; // 1.8 km/h
/** Finestra per il gradiente locale (m): coerente col max_gradient del parser. */
const GRADIENT_WINDOW_M = 100;
/** Smoothing elevazione (±m): coerente con SMOOTH_HALF_WINDOW_M del parser. */
const SMOOTH_HALF_WINDOW_M = 25;
const EARTH_RADIUS_M = 6_371_000;

// --- Parse GPX con timestamp (il parseGPX di prod scarta i <time>) -----------

interface TimedPoint {
  lat: number;
  lon: number;
  ele: number;
  dist_m: number; // cumulativa
  t_s: number; // secondi dal primo punto
}

function haversine_m(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

interface RawTrkpt {
  "@_lat"?: string | number;
  "@_lon"?: string | number;
  ele?: string | number;
  time?: string;
}

/** Estrae i punti con lat/lon/ele/time validi, con distanza e tempo cumulati. */
function parseTimedGPX(gpxString: string): TimedPoint[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
  });
  const doc = parser.parse(gpxString) as { gpx?: { trk?: unknown } };
  const gpx = doc.gpx ?? {};

  const raw: RawTrkpt[] = [];
  for (const trk of asArray(gpx.trk as Record<string, unknown> | undefined)) {
    for (const seg of asArray(
      (trk as Record<string, unknown>).trkseg as Record<string, unknown> | undefined
    )) {
      for (const pt of asArray(
        (seg as Record<string, unknown>).trkpt as RawTrkpt | RawTrkpt[] | undefined
      )) {
        raw.push(pt);
      }
    }
  }

  const points: TimedPoint[] = [];
  let cumDist = 0;
  let t0: number | null = null;
  let prev: { lat: number; lon: number } | null = null;
  for (const r of raw) {
    const lat = Number(r["@_lat"]);
    const lon = Number(r["@_lon"]);
    const ele = Number(r.ele);
    const tMs = r.time ? Date.parse(r.time) : NaN;
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      !Number.isFinite(ele) ||
      !Number.isFinite(tMs)
    ) {
      continue;
    }
    if (prev) cumDist += haversine_m(prev.lat, prev.lon, lat, lon);
    if (t0 == null) t0 = tMs;
    points.push({ lat, lon, ele, dist_m: cumDist, t_s: (tMs - t0) / 1000 });
    prev = { lat, lon };
  }
  return points;
}

/** Smoothing elevazione su finestra di distanza (±SMOOTH_HALF_WINDOW_M), O(n). */
function smoothElevation(points: TimedPoint[]): number[] {
  const n = points.length;
  const out = new Array<number>(n);
  let lo = 0;
  let hi = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const center = points[i].dist_m;
    while (lo < n && points[lo].dist_m < center - SMOOTH_HALF_WINDOW_M) {
      sum -= points[lo].ele;
      lo++;
    }
    while (hi < n && points[hi].dist_m <= center + SMOOTH_HALF_WINDOW_M) {
      sum += points[hi].ele;
      hi++;
    }
    out[i] = sum / Math.max(1, hi - lo);
  }
  return out;
}

/** Gradiente locale a `i` su finestra in avanti ~GRADIENT_WINDOW_M (frazione). */
function localGradient(points: TimedPoint[], smooth: number[], i: number): number | null {
  const n = points.length;
  let j = i + 1;
  while (j < n && points[j].dist_m - points[i].dist_m < GRADIENT_WINDOW_M) j++;
  if (j >= n) j = n - 1;
  const dx = points[j].dist_m - points[i].dist_m;
  if (dx <= 0) return null;
  return (smooth[j] - smooth[i]) / dx;
}

// --- Fasce di gradiente -------------------------------------------------------

type BandKey = "salita" | "salita_dolce" | "pianeggiante" | "discesa_dolce" | "discesa";

const BAND_LABELS: Record<BandKey, string> = {
  salita: "Salita (> +3%)",
  salita_dolce: "Salita dolce (+2% .. +3%)",
  pianeggiante: "Pianeggiante (-2% .. +2%)",
  discesa_dolce: "Discesa dolce (-3% .. -2%)",
  discesa: "Discesa (< -3%)",
};

function bandFor(gradientPct: number): BandKey {
  if (gradientPct > 3) return "salita";
  if (gradientPct > 2) return "salita_dolce";
  if (gradientPct >= -2) return "pianeggiante";
  if (gradientPct >= -3) return "discesa_dolce";
  return "discesa";
}

interface BandAcc {
  dist_m: number;
  real_moving_s: number; // tempo reale (solo punti in movimento)
  model_s: number; // tempo che impiegherebbe il modello @180W
  points: number;
}

function fmtHms(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m ${sec.toString().padStart(2, "0")}s` : `${m}m ${sec.toString().padStart(2, "0")}s`;
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function min(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)} min`;
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  // 1) Carica il GPX da docs/ → parseGPX → detectClimbs --------------------
  const gpxPath = path.join(process.cwd(), "docs", GPX_FILENAME);
  let gpxString: string;
  try {
    gpxString = await readFile(gpxPath, "utf-8");
  } catch (error) {
    return NextResponse.json(
      {
        error: `GPX non leggibile da docs/${GPX_FILENAME}`,
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }

  const parsed = parseGPX(gpxString);
  const terrain = detectClimbs(parsed.points);

  const parser_check = {
    real: { distance_km: REAL.distance_km, elevation_m: REAL.elevation_m },
    parsed: {
      distance_km: Number((parsed.total_distance_m / 1000).toFixed(2)),
      elevation_m: terrain.total_elevation_m,
      course_character: terrain.course_character,
      elevation_per_km: terrain.elevation_per_km,
      climbs_count: terrain.climbs.length,
      descents_count: terrain.descents.length,
      polyline_points: terrain.polyline.length,
    },
    delta: {
      distance_km: Number((parsed.total_distance_m / 1000 - REAL.distance_km).toFixed(2)),
      elevation_m: terrain.total_elevation_m - REAL.elevation_m,
    },
  };

  // 2) estimateRaceTime() con CP/peso reali → tre scenari -------------------
  const cpW = REAL.ftp_w;
  const weightKg = REAL.weight_kg;
  const scenarioNames = ["optimistic", "realistic", "conservative"] as const;
  const scenarios = Object.fromEntries(
    scenarioNames.map((name) => {
      const e = estimateRaceTime(terrain, cpW, weightKg, null, name);
      return [
        name,
        {
          moving_seconds: e.moving_seconds,
          total_seconds: e.total_seconds,
          moving_formatted: fmtHms(e.moving_seconds),
          total_formatted: fmtHms(e.total_seconds),
          avg_speed_kmh: e.avg_speed_kmh,
        },
      ];
    })
  ) as Record<
    (typeof scenarioNames)[number],
    {
      moving_seconds: number;
      total_seconds: number;
      moving_formatted: string;
      total_formatted: string;
      avg_speed_kmh: number;
    }
  >;

  // 3) Confronto modello (realistico) vs realtà -----------------------------
  const real = scenarios.realistic;
  const movingDeltaS = real.moving_seconds - REAL.moving_time_s;
  const speedDelta = real.avg_speed_kmh - REAL.avg_speed_kmh;
  const comparison = {
    note: "Lo scenario realistico gira a potenza ≈ CP·fatica (≈ 218 W), ben sopra i 180 W reali: per questo finisce prima. La fonte dell'errore di potenza vs terreno è isolata al punto 4.",
    moving_time: {
      real_s: REAL.moving_time_s,
      real_formatted: fmtHms(REAL.moving_time_s),
      model_s: real.moving_seconds,
      model_formatted: real.moving_formatted,
      delta_min: min(movingDeltaS / 60),
      delta_pct: pct((movingDeltaS / REAL.moving_time_s) * 100),
    },
    avg_speed: {
      real_kmh: REAL.avg_speed_kmh,
      model_kmh: real.avg_speed_kmh,
      delta_kmh: Number(speedDelta.toFixed(1)),
      delta_pct: pct((speedDelta / REAL.avg_speed_kmh) * 100),
    },
  };

  // 4) Diagnosi per fasce di gradiente (timestamp del GPX) ------------------
  const timed = parseTimedGPX(gpxString);
  const smooth = smoothElevation(timed);

  const bands: Record<BandKey, BandAcc> = {
    salita: { dist_m: 0, real_moving_s: 0, model_s: 0, points: 0 },
    salita_dolce: { dist_m: 0, real_moving_s: 0, model_s: 0, points: 0 },
    pianeggiante: { dist_m: 0, real_moving_s: 0, model_s: 0, points: 0 },
    discesa_dolce: { dist_m: 0, real_moving_s: 0, model_s: 0, points: 0 },
    discesa: { dist_m: 0, real_moving_s: 0, model_s: 0, points: 0 },
  };

  let stoppedTime_s = 0;
  let stoppedDist_m = 0;
  let totalMoving_s = 0;
  let totalDist_m = 0;

  for (let i = 0; i < timed.length - 1; i++) {
    const segDist = timed[i + 1].dist_m - timed[i].dist_m;
    const dt = timed[i + 1].t_s - timed[i].t_s;
    if (segDist <= 0 || dt <= 0) continue;

    const realSpeed = segDist / dt;
    if (realSpeed < MOVING_MIN_MPS) {
      stoppedTime_s += dt;
      stoppedDist_m += segDist;
      continue; // fermo: fuori dall'analisi del movimento
    }

    const grad = localGradient(timed, smooth, i);
    if (grad == null) continue;
    const gradPct = grad * 100;

    // Modello a 180 W reali, stesso solveVelocity di estimateRaceTime (peso
    // atleta senza massa bici, come fa il modello di prod).
    const modelSpeed = solveVelocity(REAL.avg_power_w, weightKg, grad);

    const b = bands[bandFor(gradPct)];
    b.dist_m += segDist;
    b.real_moving_s += dt;
    b.model_s += segDist / modelSpeed;
    b.points += 1;

    totalMoving_s += dt;
    totalDist_m += segDist;
  }

  const diagnosis_by_gradient = (Object.keys(bands) as BandKey[]).map((key) => {
    const b = bands[key];
    const realAvg = b.real_moving_s > 0 ? (b.dist_m / b.real_moving_s) * 3.6 : 0;
    const modelAvg = b.model_s > 0 ? (b.dist_m / b.model_s) * 3.6 : 0;
    const deltaSpeed = modelAvg - realAvg;
    return {
      band: BAND_LABELS[key],
      distance_km: Number((b.dist_m / 1000).toFixed(2)),
      share_of_distance: totalDist_m > 0 ? pct((b.dist_m / totalDist_m) * 100) : "—",
      real_time: fmtHms(b.real_moving_s),
      real_speed_kmh: Number(realAvg.toFixed(1)),
      model_speed_kmh_at_180w: Number(modelAvg.toFixed(1)),
      delta_speed_kmh: Number(deltaSpeed.toFixed(1)),
      delta_speed_pct: realAvg > 0 ? pct((deltaSpeed / realAvg) * 100) : "—",
      model_too_fast: deltaSpeed > 0,
      points: b.points,
    };
  });

  // Se il modello girasse alla potenza REALE (180 W), che tempo darebbe?
  const modelMovingAt180_s = (Object.values(bands) as BandAcc[]).reduce(
    (s, b) => s + b.model_s,
    0
  );

  const moving_check = {
    note: "Validazione del parse con timestamp: il moving ricostruito (esclusi i punti fermi) deve avvicinarsi ai 11288 s reali.",
    reconstructed_moving_s: Math.round(totalMoving_s),
    reconstructed_moving_formatted: fmtHms(totalMoving_s),
    real_moving_s: REAL.moving_time_s,
    stopped_time_s: Math.round(stoppedTime_s),
    stopped_time_formatted: fmtHms(stoppedTime_s),
    stopped_distance_m: Math.round(stoppedDist_m),
    elapsed_total_s: Math.round(timed.length > 0 ? timed[timed.length - 1].t_s : 0),
    distance_covered_km: Number((totalDist_m / 1000).toFixed(2)),
  };

  const model_at_real_power = {
    note: "Tempo di percorrenza che darebbe la FISICA del modello alimentata a 180 W reali (somma sui tratti in movimento). Isola l'errore di terreno dall'errore di potenza.",
    moving_s: Math.round(modelMovingAt180_s),
    moving_formatted: fmtHms(modelMovingAt180_s),
    real_moving_s: REAL.moving_time_s,
    delta_min: min((modelMovingAt180_s - REAL.moving_time_s) / 60),
    delta_pct: pct(((modelMovingAt180_s - REAL.moving_time_s) / REAL.moving_time_s) * 100),
  };

  return NextResponse.json({
    _route: "GET /api/debug/calibrate-estimate (dev only)",
    inputs: REAL,
    parser_check,
    model_scenarios: {
      note: `estimateRaceTime() con CP=${cpW} W (FTP epoca), peso=${weightKg} kg, ctl=null.`,
      scenarios,
    },
    comparison_reality: comparison,
    moving_check,
    model_at_real_power,
    diagnosis_by_gradient: {
      method: `Velocità reale per fascia dai timestamp del GPX (punti fermi <${MOVING_MIN_MPS} m/s esclusi), gradiente locale su finestra ~${GRADIENT_WINDOW_M} m con elevazione liscia ±${SMOOTH_HALF_WINDOW_M} m. "Modello @180W" = solveVelocity(180, ${weightKg}, gradiente) sugli stessi tratti. delta>0 ⇒ il modello è troppo veloce su quel terreno.`,
      bands: diagnosis_by_gradient,
    },
  });
}
