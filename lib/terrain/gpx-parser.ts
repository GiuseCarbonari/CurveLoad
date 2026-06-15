import { XMLParser } from "fast-xml-parser";

/**
 * Parser GPX e detection salite (Modulo Profilo §33 C.6) — funzioni PURE,
 * nessuna chiamata API. Replica le SOGLIE verificate di Section 11 sync.py
 * (categoria per dislivello, max_gradient su scala attenuata, esclusione
 * kicker <100 m, course_character) per produrre un `terrain_summary`
 * identico allo schema `routes.json`.
 *
 * NB: l'algoritmo di segmentazione delle salite (estremi con tolleranza) è
 * una v0 deterministica nostra — Section 11 non è in questo repo; ciò che
 * replichiamo esattamente sono le soglie/output documentati in PRD §33 C.6.
 * Le durate/fatica NON si stimano qui (vedi gap-analysis.ts): qui si legge
 * solo la geometria del percorso.
 */

export interface TerrainPoint {
  lat: number;
  lon: number;
  ele: number;
  distFromStart_m: number;
}

export interface ParsedGPX {
  points: TerrainPoint[];
  total_distance_m: number;
  total_elevation_m: number;
}

export interface Coords {
  lat: number;
  lon: number;
}

/** Categoria salita per dislivello guadagnato (UCI-derived, Section 11). */
export type ClimbCategory = "HC" | "Cat 1" | "Cat 2" | "Cat 3" | "Cat 4" | null;

export interface Climb {
  position_km: number;
  distance_km: number;
  elevation_m: number;
  avg_gradient_pct: number;
  max_gradient_pct: number;
  category: ClimbCategory;
  start_coords: Coords;
  end_coords: Coords;
}

/** Discesa: stessa struttura senza categoria/max_gradient (PRD §33 C.6). */
export interface Descent {
  position_km: number;
  distance_km: number;
  elevation_m: number; // dislivello perso (positivo)
  avg_gradient_pct: number; // negativo
  start_coords: Coords;
  end_coords: Coords;
}

export type CourseCharacter = "flat" | "rolling" | "hilly" | "mountain";

export interface TerrainSummary {
  total_distance_km: number;
  total_elevation_m: number;
  elevation_per_km: number;
  course_character: CourseCharacter;
  climbs: Climb[];
  descents: Descent[];
  /** [km, lat, lon, ele] ogni ~500 m. */
  polyline: Array<[number, number, number, number]>;
}

// --- Costanti (soglie Section 11, PRD §33 C.6) -------------------------------

/** Soglia minima di dislivello per essere una salita "sostenuta" (kicker esclusi). */
const MIN_CLIMB_GAIN_M = 100;
/** Soglia minima di dislivello perso per una discesa "sostenuta". */
const MIN_DESCENT_DROP_M = 100;
/** Tolleranza per gli estremi (m): dislivelli minori non spezzano il trend. */
const EXTREME_TOLERANCE_M = 20;
/** Finestra (m) per lo smoothing dell'elevazione e per il max gradient. */
const SMOOTH_HALF_WINDOW_M = 25;
const MAX_GRADIENT_WINDOW_M = 100;
/** Passo della polyline (m). */
const POLYLINE_STEP_M = 500;

const EARTH_RADIUS_M = 6_371_000;

// --- Haversine ---------------------------------------------------------------

function haversine_m(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

// --- parseGPX ----------------------------------------------------------------

interface RawTrkpt {
  "@_lat"?: string | number;
  "@_lon"?: string | number;
  ele?: string | number;
}

/** Coerce in array: fast-xml-parser collassa i singoletti in oggetti. */
function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Somma dei dislivelli positivi su elevazione liscia → D+ totale (stima).
 * Lo smoothing riduce il rumore GPS che altrimenti gonfia il dislivello.
 */
function cumulativePositiveGain(ele: number[]): number {
  let gain = 0;
  for (let i = 1; i < ele.length; i++) {
    const d = ele[i] - ele[i - 1];
    if (d > 0) gain += d;
  }
  return gain;
}

/**
 * Smoothing dell'elevazione su finestra di distanza (±SMOOTH_HALF_WINDOW_M),
 * a due puntatori (O(n)). Restituisce un nuovo array di elevazioni lisce.
 */
function smoothElevation(points: TerrainPoint[]): number[] {
  const n = points.length;
  const out = new Array<number>(n);
  let lo = 0;
  let hi = 0;
  let sum = 0;
  // Finestra scorrevole [lo, hi) sui punti entro ±half window in distanza.
  for (let i = 0; i < n; i++) {
    const center = points[i].distFromStart_m;
    while (lo < n && points[lo].distFromStart_m < center - SMOOTH_HALF_WINDOW_M) {
      sum -= points[lo].ele;
      lo++;
    }
    while (hi < n && points[hi].distFromStart_m <= center + SMOOTH_HALF_WINDOW_M) {
      sum += points[hi].ele;
      hi++;
    }
    out[i] = sum / Math.max(1, hi - lo);
  }
  return out;
}

/**
 * Legge un file GPX (XML). Supporta sia track (`trk/trkseg/trkpt`) sia route
 * (`rte/rtept`). Solo punti con `ele` valido entrano nel risultato.
 */
export function parseGPX(gpxString: string): ParsedGPX {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
  });
  const doc = parser.parse(gpxString) as {
    gpx?: {
      trk?: unknown;
      rte?: unknown;
    };
  };

  const gpx = doc.gpx ?? {};

  // Raccoglie i trkpt da tutti i trk/trkseg, oppure i rtept come fallback.
  const rawPoints: RawTrkpt[] = [];
  for (const trk of asArray(gpx.trk as Record<string, unknown> | undefined)) {
    for (const seg of asArray(
      (trk as Record<string, unknown>).trkseg as Record<string, unknown> | undefined
    )) {
      for (const pt of asArray(
        (seg as Record<string, unknown>).trkpt as RawTrkpt | RawTrkpt[] | undefined
      )) {
        rawPoints.push(pt);
      }
    }
  }
  if (rawPoints.length === 0) {
    for (const rte of asArray(gpx.rte as Record<string, unknown> | undefined)) {
      for (const pt of asArray(
        (rte as Record<string, unknown>).rtept as RawTrkpt | RawTrkpt[] | undefined
      )) {
        rawPoints.push(pt);
      }
    }
  }

  // Converte e tiene solo i punti con lat/lon/ele numerici validi.
  const points: TerrainPoint[] = [];
  let cumDist = 0;
  let prev: { lat: number; lon: number } | null = null;
  for (const raw of rawPoints) {
    const lat = Number(raw["@_lat"]);
    const lon = Number(raw["@_lon"]);
    const ele = Number(raw.ele);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(ele)) {
      continue; // "solo punti con ele valido"
    }
    if (prev) {
      cumDist += haversine_m(prev.lat, prev.lon, lat, lon);
    }
    points.push({ lat, lon, ele, distFromStart_m: cumDist });
    prev = { lat, lon };
  }

  const total_distance_m = points.length > 0 ? points[points.length - 1].distFromStart_m : 0;
  const total_elevation_m = cumulativePositiveGain(smoothElevation(points));

  return { points, total_distance_m, total_elevation_m };
}

// --- detectClimbs ------------------------------------------------------------

function categoryFor(elevationGain: number): ClimbCategory {
  if (elevationGain >= 1000) return "HC";
  if (elevationGain >= 650) return "Cat 1";
  if (elevationGain >= 400) return "Cat 2";
  if (elevationGain >= 200) return "Cat 3";
  if (elevationGain >= 100) return "Cat 4";
  return null; // <100 m: kicker, non entra in climbs[]
}

function courseCharacterFor(elevationPerKm: number): CourseCharacter {
  if (elevationPerKm >= 30) return "mountain";
  if (elevationPerKm >= 20) return "hilly";
  if (elevationPerKm >= 5) return "rolling";
  return "flat";
}

interface Extreme {
  idx: number;
  ele: number;
}

/**
 * Estremi alternati (valle/picco) con tolleranza: un'inversione conta solo se
 * supera EXTREME_TOLERANCE_M, così le micro-ondulazioni non spezzano i trend.
 */
function findExtrema(ele: number[]): Extreme[] {
  const n = ele.length;
  if (n === 0) return [];
  const extrema: Extreme[] = [];
  let dir = 0; // 0 indeciso, 1 salita, -1 discesa
  let peakIdx = 0;
  let peakEle = ele[0];
  let valleyIdx = 0;
  let valleyEle = ele[0];

  for (let i = 1; i < n; i++) {
    const e = ele[i];
    if (e > peakEle) {
      peakEle = e;
      peakIdx = i;
    }
    if (e < valleyEle) {
      valleyEle = e;
      valleyIdx = i;
    }
    if (dir >= 0 && peakEle - e > EXTREME_TOLERANCE_M) {
      // Stavamo salendo (o indecisi) e ora siamo scesi oltre tolleranza:
      // il picco è confermato come estremo, si passa in discesa.
      extrema.push({ idx: peakIdx, ele: peakEle });
      dir = -1;
      valleyIdx = i;
      valleyEle = e;
    } else if (dir <= 0 && e - valleyEle > EXTREME_TOLERANCE_M) {
      extrema.push({ idx: valleyIdx, ele: valleyEle });
      dir = 1;
      peakIdx = i;
      peakEle = e;
    }
  }
  // Chiusura: aggiungi l'estremo pendente del trend corrente.
  extrema.push(dir >= 0 ? { idx: peakIdx, ele: peakEle } : { idx: valleyIdx, ele: valleyEle });
  return extrema;
}

/** Max gradiente su finestre ~100 m (scala attenuata dallo smoothing). */
function maxGradient(
  points: TerrainPoint[],
  smooth: number[],
  startIdx: number,
  endIdx: number
): number {
  let max = 0;
  let j = startIdx;
  for (let i = startIdx; i < endIdx; i++) {
    while (
      j < endIdx &&
      points[j].distFromStart_m - points[i].distFromStart_m < MAX_GRADIENT_WINDOW_M
    ) {
      j++;
    }
    if (j >= endIdx) break;
    const dx = points[j].distFromStart_m - points[i].distFromStart_m;
    if (dx <= 0) continue;
    const grad = ((smooth[j] - smooth[i]) / dx) * 100;
    if (grad > max) max = grad;
  }
  return max;
}

/** Resampling della polyline ogni ~500 m. */
function buildPolyline(
  points: TerrainPoint[]
): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [];
  if (points.length === 0) return out;
  let nextMark = 0;
  for (const p of points) {
    if (p.distFromStart_m >= nextMark) {
      out.push([
        Number((p.distFromStart_m / 1000).toFixed(2)),
        Number(p.lat.toFixed(5)),
        Number(p.lon.toFixed(5)),
        Math.round(p.ele),
      ]);
      nextMark += POLYLINE_STEP_M;
    }
  }
  // Garantisci l'ultimo punto.
  const last = points[points.length - 1];
  const lastMark = out[out.length - 1];
  if (!lastMark || lastMark[0] !== Number((last.distFromStart_m / 1000).toFixed(2))) {
    out.push([
      Number((last.distFromStart_m / 1000).toFixed(2)),
      Number(last.lat.toFixed(5)),
      Number(last.lon.toFixed(5)),
      Math.round(last.ele),
    ]);
  }
  return out;
}

/**
 * Rileva salite e discese sostenute e compone il terrain_summary.
 * Replica le soglie Section 11: categoria per dislivello, esclusione <100 m,
 * max_gradient su elevazione liscia (scala attenuata), course_character.
 */
export function detectClimbs(points: TerrainPoint[]): TerrainSummary {
  const total_distance_m = points.length > 0 ? points[points.length - 1].distFromStart_m : 0;
  const total_distance_km = total_distance_m / 1000;

  if (points.length < 2) {
    return {
      total_distance_km: Number(total_distance_km.toFixed(2)),
      total_elevation_m: 0,
      elevation_per_km: 0,
      course_character: "flat",
      climbs: [],
      descents: [],
      polyline: buildPolyline(points),
    };
  }

  const smooth = smoothElevation(points);
  const total_elevation_m = Math.round(cumulativePositiveGain(smooth));
  const elevation_per_km =
    total_distance_km > 0 ? total_elevation_m / total_distance_km : 0;

  const extrema = findExtrema(smooth);
  const climbs: Climb[] = [];
  const descents: Descent[] = [];

  for (let k = 0; k < extrema.length - 1; k++) {
    const a = extrema[k];
    const b = extrema[k + 1];
    const delta = b.ele - a.ele;
    const horizontal = points[b.idx].distFromStart_m - points[a.idx].distFromStart_m;
    if (horizontal <= 0) continue;

    if (delta >= MIN_CLIMB_GAIN_M) {
      const elevation_m = Math.round(delta);
      climbs.push({
        position_km: Number((points[a.idx].distFromStart_m / 1000).toFixed(2)),
        distance_km: Number((horizontal / 1000).toFixed(2)),
        elevation_m,
        avg_gradient_pct: Number(((delta / horizontal) * 100).toFixed(1)),
        max_gradient_pct: Number(maxGradient(points, smooth, a.idx, b.idx).toFixed(1)),
        category: categoryFor(elevation_m),
        start_coords: { lat: points[a.idx].lat, lon: points[a.idx].lon },
        end_coords: { lat: points[b.idx].lat, lon: points[b.idx].lon },
      });
    } else if (-delta >= MIN_DESCENT_DROP_M) {
      descents.push({
        position_km: Number((points[a.idx].distFromStart_m / 1000).toFixed(2)),
        distance_km: Number((horizontal / 1000).toFixed(2)),
        elevation_m: Math.round(-delta),
        avg_gradient_pct: Number(((delta / horizontal) * 100).toFixed(1)),
        start_coords: { lat: points[a.idx].lat, lon: points[a.idx].lon },
        end_coords: { lat: points[b.idx].lat, lon: points[b.idx].lon },
      });
    }
  }

  return {
    total_distance_km: Number(total_distance_km.toFixed(2)),
    total_elevation_m,
    elevation_per_km: Number(elevation_per_km.toFixed(1)),
    course_character: courseCharacterFor(elevation_per_km),
    climbs,
    descents,
    polyline: buildPolyline(points),
  };
}
