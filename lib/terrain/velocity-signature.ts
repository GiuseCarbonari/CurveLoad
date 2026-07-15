/**
 * Firma di velocità per fascia di pendenza (M7, modello a 3 livelli) —
 * funzioni PURE, nessuna chiamata API (le chiamate le fa il chiamante e passa
 * gli stream già scaricati).
 *
 * Idea: invece di stimare la velocità dalla fisica (accurata SOLO in salita,
 * vedi docs/CALIBRATION_NOTES.md), si IMPARA la velocità reale dell'atleta per
 * ogni fascia di pendenza dalle sue attività MTB passate (Livello 1). Quando i
 * dati personali non bastano si usa un archetipo MTB ancorato a dati reali
 * verificati (Livello 2). La fisica resta come fallback solo in salita (L3).
 */

import { solveVelocity } from "@/lib/terrain/race-estimator";

// --- Tipi --------------------------------------------------------------------

/** Una fascia di pendenza con la velocità tipica osservata. */
export interface GradientBucket {
  /** Centro della fascia in PERCENTUALE (es. -10, -2.5, 0, 5, 10). */
  gradient_pct: number;
  /** Mediana della velocità in quella fascia (m/s). */
  velocity_ms: number;
  /** Quanti secondi di dati hanno contribuito. */
  sample_count: number;
  /** true se sample_count ≥ 120 (≥ 2 min di dati): fascia affidabile. */
  reliable: boolean;
}

export interface VelocitySignature {
  athlete_id: string;
  built_at: string;
  activities_used: number;
  total_samples: number;
  buckets: GradientBucket[];
  /** 1 = personale (dai dati dell'atleta), 2 = archetipo seed. */
  level: 1 | 2;
  /** % di fasce OSSERVATE che sono affidabili (reliable). */
  coverage_pct: number;
}

/** Stream attività come da /activity/{id}/streams.json (vedi INTERVALS_API_NOTES). */
export interface ActivityStream {
  type: string;
  name?: string;
  data: Array<number | null>;
  data2?: Array<number | null>;
}

/** Metadati minimi attività per la calibrazione. */
export interface ActivityMeta {
  id: string | number;
  type: string | null;
  moving_time: number | null;
  distance: number | null;
}

// --- Costanti ----------------------------------------------------------------

/** Passo delle fasce di pendenza (frazione): 2.5%. */
const BUCKET_STEP = 0.025;
/** Estremi di clamp della pendenza. */
const GRADIENT_MIN = -0.2;
const GRADIENT_MAX = 0.2;
/** Finestra (s) per smussare il gradiente dal rumore GPS. */
const GRADIENT_WINDOW_S = 60;
/**
 * Velocità minima (m/s) perché un secondo conti: esclude soste/code/navigazione
 * (CAMBIO 2). 1.0 m/s = 3.6 km/h: sotto non è "percorrenza".
 */
const MIN_MOVING_MS = 1.0;
/** Sopra questa pendenza in DISCESA si usa il 75° percentile (CAMBIO 3). */
const DESCENT_PERCENTILE_PCT = -3;
const DESCENT_PERCENTILE = 0.75;
/** Soglia di affidabilità: 2 minuti di dati. */
const RELIABLE_SAMPLES = 120;
/** Copertura minima per dichiarare la firma "personale" (Livello 1). */
const LEVEL1_COVERAGE_PCT = 60;
/** Vincoli del set di calibrazione (limite chiamate API). */
const MIN_MOVING_TIME_S = 1800; // 30 min
const MAX_ACTIVITIES = 20;

/**
 * ARCHETYPE_SEED — curve medie MTB per fascia, ancorate a DATI VERIFICATI.
 *
 * Fonte (docs/CALIBRATION_NOTES.md, gara reale Rampichilonero 2024,
 * 43.44 km / 1558 m D+ / 180 W medi / 76 kg → 13.8 km/h media, per fasce):
 *  - Pianeggiante (±2%): velocità reale 17.6 km/h a 180 W → seed 18 km/h.
 *  - Discesa dolce (−3..−2%): reale 21.1 km/h → seed 21 km/h.
 *  - Discesa (<−3%): reale 26.2 km/h → seed 24–26 km/h (proxy MTB, capato).
 *  - Salita (>3%): reale ~7.8 km/h sulla fascia (≈9% medio) → seed ancorato
 *    a quel valore e poi sceso/salito monotòno per le fasce vicine (la fisica
 *    a 180 W è risultata accurata in salita, +1.4%).
 * Valori in km/h, convertiti in m/s. Monotòni: più ripido in salita = più
 * lento; in discesa più veloce fino a un cap tecnico MTB.
 */
const SEED_KMH: Array<{ gradient_pct: number; kmh: number }> = [
  { gradient_pct: -20, kmh: 20 },
  { gradient_pct: -17.5, kmh: 22 },
  { gradient_pct: -15, kmh: 24 },
  { gradient_pct: -12.5, kmh: 25 },
  { gradient_pct: -10, kmh: 26 },
  { gradient_pct: -7.5, kmh: 26 },
  { gradient_pct: -5, kmh: 25 },
  { gradient_pct: -2.5, kmh: 21 },
  { gradient_pct: 0, kmh: 18 },
  { gradient_pct: 2.5, kmh: 15.5 },
  { gradient_pct: 5, kmh: 12.5 },
  { gradient_pct: 7.5, kmh: 9.5 },
  { gradient_pct: 10, kmh: 7.8 },
  { gradient_pct: 12.5, kmh: 6.5 },
  { gradient_pct: 15, kmh: 5.5 },
  { gradient_pct: 20, kmh: 4.5 },
];

/** Archetipo come bucket affidabili (sample_count=0: è la baseline, non dati). */
export const ARCHETYPE_SEED: GradientBucket[] = SEED_KMH.map((s) => ({
  gradient_pct: s.gradient_pct,
  velocity_ms: Number((s.kmh / 3.6).toFixed(3)),
  sample_count: 0,
  reliable: true,
}));

// --- Helper ------------------------------------------------------------------

/** Centro fascia in percentuale dato un gradiente in frazione. */
function bucketCenterPct(gradientFrac: number): number {
  const clamped = Math.max(GRADIENT_MIN, Math.min(GRADIENT_MAX, gradientFrac));
  const snapped = Math.round(clamped / BUCKET_STEP) * BUCKET_STEP;
  return Number((snapped * 100).toFixed(1));
}

/**
 * Media pesata per DISTANZA (non per tempo): ogni velocità pesa per la strada
 * che rappresenta in quel secondo. Σ(v·v)/Σv = Σv²/Σv. Corregge il bias che
 * sovrappesa i secondi lenti (la velocità rappresentativa di un tratto è quella
 * a cui lo PERCORRI, non quella a cui ci stai sopra). Vuoto → 0.
 */
function weightedMeanByDistance(values: number[]): number {
  let sumV = 0;
  let sumV2 = 0;
  for (const v of values) {
    sumV += v;
    sumV2 += v * v;
  }
  return sumV > 0 ? sumV2 / sumV : 0;
}

/** Percentile p (0–1) di un array, con interpolazione lineare. Vuoto → 0. */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Estrae i data[] di uno stream per tipo. */
function streamData(streams: ActivityStream[], type: string): Array<number | null> | null {
  return streams.find((s) => s.type === type)?.data ?? null;
}

/** Bucket dell'archetipo più vicino a una pendenza (frazione). */
export function seedBucketFor(gradientFrac: number): GradientBucket {
  const pct = gradientFrac * 100;
  let best = ARCHETYPE_SEED[0];
  let bestDiff = Infinity;
  for (const b of ARCHETYPE_SEED) {
    const diff = Math.abs(b.gradient_pct - pct);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = b;
    }
  }
  return best;
}

// --- buildSignatureFromStreams ----------------------------------------------

/**
 * Costruisce i bucket di velocità per fascia da UNA attività.
 *
 * Per ogni secondo i (da GRADIENT_WINDOW_S in poi): il gradiente è la
 * variazione di quota sugli ultimi 60 s diviso la distanza percorsa in quei
 * 60 s (somma delle velocità ≈ metri, perché i campioni sono a 1 Hz). La
 * finestra di 60 s smussa il rumore GPS. Si accumula la velocità del secondo
 * nella fascia corrispondente (solo se in movimento e con quota valida).
 */
export function buildSignatureFromStreams(
  streams: ActivityStream[],
  distanceM: number
): GradientBucket[] {
  const altitude = streamData(streams, "altitude");
  const velocity = streamData(streams, "velocity_smooth");
  if (!altitude || altitude.length < GRADIENT_WINDOW_S + 1) return [];

  const n = altitude.length;
  // Velocità: se manca lo stream, ripiega su velocità uniforme da distanceM.
  const uniform =
    distanceM > 0 && n > 0 ? distanceM / n : 0;
  const vAt = (i: number): number => {
    const v = velocity?.[i];
    return v != null && Number.isFinite(v) ? v : uniform;
  };

  // Accumulo velocità per centro-fascia (percentuale).
  const byBucket = new Map<number, number[]>();

  for (let i = GRADIENT_WINDOW_S; i < n; i++) {
    const altNow = altitude[i];
    const altPast = altitude[i - GRADIENT_WINDOW_S];
    if (altNow == null || altPast == null || !Number.isFinite(altNow) || !Number.isFinite(altPast)) {
      continue;
    }
    // Distanza percorsa nella finestra ≈ somma velocità (1 Hz).
    let dist60 = 0;
    for (let k = i - GRADIENT_WINDOW_S + 1; k <= i; k++) dist60 += vAt(k);
    if (dist60 <= 1) continue; // fermo o quasi: gradiente non affidabile

    const gradient = (altNow - altPast) / dist60;
    const v = vAt(i);
    if (v < MIN_MOVING_MS) continue; // CAMBIO 2: scarta soste/code

    const center = bucketCenterPct(gradient);
    const arr = byBucket.get(center);
    if (arr) arr.push(v);
    else byBucket.set(center, [v]);
  }

  const buckets: GradientBucket[] = [];
  for (const [center, vels] of Array.from(byBucket.entries())) {
    // CAMBIO 3: discese (<−3%) → 75° percentile (in gara scendi più deciso);
    // salite e piano → media pesata per distanza (CAMBIO 1).
    const velocity_ms =
      center < DESCENT_PERCENTILE_PCT
        ? percentile(vels, DESCENT_PERCENTILE)
        : weightedMeanByDistance(vels);
    buckets.push({
      gradient_pct: center,
      velocity_ms: Number(velocity_ms.toFixed(3)),
      sample_count: vels.length,
      reliable: vels.length >= RELIABLE_SAMPLES,
    });
  }
  return buckets.sort((a, b) => a.gradient_pct - b.gradient_pct);
}

// --- buildAthleteSignature ---------------------------------------------------

/**
 * Costruisce la firma personale aggregando fino a 20 attività MTB (≥30 min).
 * Per ogni attività scarica gli stream (callback iniettata) e ne ricava i
 * bucket; poi aggrega per fascia con media pesata sul sample_count. Se la
 * copertura (fasce osservate affidabili) ≥ 60% → Livello 1; altrimenti
 * Livello 2 (merge con ARCHETYPE_SEED).
 */
export async function buildAthleteSignature(
  athleteId: string,
  activities: ActivityMeta[],
  fetchStreams: (id: string) => Promise<ActivityStream[]>,
  builtAt: string = new Date().toISOString()
): Promise<VelocitySignature> {
  const mtb = activities
    .filter((a) => a.type === "MountainBikeRide" && (a.moving_time ?? 0) > MIN_MOVING_TIME_S)
    .slice(0, MAX_ACTIVITIES);

  // Aggregazione per centro-fascia: somma pesi e media pesata delle mediane.
  const agg = new Map<number, { weightedSum: number; count: number }>();
  let activitiesUsed = 0;

  for (const act of mtb) {
    let streams: ActivityStream[];
    try {
      streams = await fetchStreams(String(act.id));
    } catch {
      continue; // un'attività che fallisce non blocca la calibrazione
    }
    const buckets = buildSignatureFromStreams(streams, act.distance ?? 0);
    if (buckets.length === 0) continue;
    activitiesUsed++;
    for (const b of buckets) {
      const cur = agg.get(b.gradient_pct) ?? { weightedSum: 0, count: 0 };
      cur.weightedSum += b.velocity_ms * b.sample_count;
      cur.count += b.sample_count;
      agg.set(b.gradient_pct, cur);
    }
  }

  const personalBuckets: GradientBucket[] = Array.from(agg.entries())
    .map(([center, { weightedSum, count }]) => ({
      gradient_pct: center,
      velocity_ms: count > 0 ? Number((weightedSum / count).toFixed(3)) : 0,
      sample_count: count,
      reliable: count >= RELIABLE_SAMPLES,
    }))
    .sort((a, b) => a.gradient_pct - b.gradient_pct);

  const totalSamples = personalBuckets.reduce((s, b) => s + b.sample_count, 0);
  const observed = personalBuckets.length;
  const reliableCount = personalBuckets.filter((b) => b.reliable).length;
  const coveragePct = observed > 0 ? Math.round((reliableCount / observed) * 100) : 0;

  if (coveragePct >= LEVEL1_COVERAGE_PCT && observed > 0) {
    return {
      athlete_id: athleteId,
      built_at: builtAt,
      activities_used: activitiesUsed,
      total_samples: totalSamples,
      buckets: personalBuckets,
      level: 1,
      coverage_pct: coveragePct,
    };
  }

  // Livello 2: archetipo, con override dalle fasce personali AFFIDABILI.
  const reliableByCenter = new Map(
    personalBuckets.filter((b) => b.reliable).map((b) => [b.gradient_pct, b])
  );
  const merged: GradientBucket[] = ARCHETYPE_SEED.map((seed) => {
    const personal = reliableByCenter.get(seed.gradient_pct);
    return personal ? { ...personal } : { ...seed };
  });

  return {
    athlete_id: athleteId,
    built_at: builtAt,
    activities_used: activitiesUsed,
    total_samples: totalSamples,
    buckets: merged,
    level: 2,
    coverage_pct: coveragePct,
  };
}

/** Firma di solo archetipo (Livello 2), quando non c'è alcun dato personale. */
export function archetypeSignature(
  athleteId: string,
  builtAt: string = new Date().toISOString()
): VelocitySignature {
  return {
    athlete_id: athleteId,
    built_at: builtAt,
    activities_used: 0,
    total_samples: 0,
    buckets: ARCHETYPE_SEED.map((b) => ({ ...b })),
    level: 2,
    coverage_pct: 0,
  };
}

/**
 * Velocità fisica pura (L3) — solo salita, dove il modello è accurato.
 * `cda`/`crr` opzionali: propagati a solveVelocity per il Race Planner (M1),
 * default alle costanti MTB se non passati.
 */
export function physicsVelocity(
  gradientFrac: number,
  cpW: number,
  weightKg: number,
  powerFraction: number,
  cda?: number,
  crr?: number
): number {
  return solveVelocity(cpW * powerFraction, weightKg, gradientFrac, cda, crr);
}
