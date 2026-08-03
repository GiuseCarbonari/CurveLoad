/**
 * Pace profile — funzioni pure del Modulo Corsa, parte 1 (Passo 9).
 *
 * Nessuna chiamata API, nessun clock, nessun DB: stessi input → stesso
 * output, testato in tests/pace-profile.test.ts con una fixture sintetica
 * (CS/D′ noti a priori — vedi spec §7).
 *
 * File unico (decisione §1.2): a differenza del lato bici (power-profile.ts
 * + build-profile.ts) qui non c'è nulla da aggregare oltre al motore stesso
 * (niente durability, niente route_settings per la corsa), quindi le
 * primitive e l'orchestratore `buildRunnerProfile` vivono nello stesso file.
 *
 * Modello CS/D′ (decisione §1.3): è un modello NOSTRO, dichiarato come tale
 * (`model: "CS_2P_LINEAR"`, `source: "app_cs2p_fit"`), esattamente come
 * `estimatePowerLawCP` in power-profile.ts. La verifica dell'endpoint
 * (docs/INTERVALS_API_NOTES.md, sezione "Endpoint pace profile") non ha
 * confermato un array di modelli pre-calcolati equivalente a `powerModels[]`
 * per la corsa: niente `extractCSD` da leggere, il fit è l'unica via. La
 * regola "No Virtual Math" resta rispettata perché i punti della curva
 * (secs[]/values[]) si LEGGONO, solo il fit CS/D′ è nostro ed è etichettato.
 */

// --- Tipi della risposta pace-curves.json (struttura verificata §2) --------

export interface PaceCurve {
  id: string; // "42d" | "90d" | "1y" | "all"
  label?: string;
  days?: number;
  secs: number[]; // durate in secondi
  values: number[]; // velocità in m/s, stesso indice di secs[]
}

export interface PaceCurvesResponse {
  list: PaceCurve[];
}

// --- Guard di plausibilità velocità (rete di sicurezza, §4.4) --------------

const MIN_PLAUSIBLE_SPEED_MPS = 0.5;
const MAX_PLAUSIBLE_SPEED_MPS = 12;

/**
 * Applica insieme i guard "valore mancante/null/0/negativo" e "velocità
 * fuori dal range fisiologico umano (0.5–12 m/s)": una velocità implausibile
 * difende da unità sbagliate o dati sporchi. Se il valore non è plausibile
 * si preferisce "nessun numero" a un numero falso (No Virtual Math).
 */
function plausibleSpeedMps(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  if (raw < MIN_PLAUSIBLE_SPEED_MPS || raw > MAX_PLAUSIBLE_SPEED_MPS) return null;
  return raw;
}

// --- a) extractPaceProfile ---------------------------------------------------

/** Durate standard del Record Pace Profile. Nessuna sotto i 60s (§4.3): il
 * passo sotto il minuto arriva da GPS smussato, non è un dato affidabile
 * come i watt a 1s (differenza deliberata con DEFAULT_MMP_TARGETS_SECS). */
export const DEFAULT_RPP_TARGETS_SECS: readonly number[] = [
  60, 120, 300, 600, 900, 1200, 1800, 3600,
];

export interface RPPPoint {
  /** Durata richiesta (secondi). */
  duration_s: number;
  /** Durata del punto realmente trovato in secs[] (per audit). */
  actual_secs: number | null;
  speed_mps: number | null;
  /** 1000 / speed_mps. null se speed_mps è null: mai una divisione per zero. */
  pace_s_per_km: number | null;
  /** speed_mps * duration_s. null se speed_mps è null. */
  distance_m: number | null;
  /** false se la durata richiesta non è esattamente presente in secs[]. */
  exact: boolean;
}

/**
 * Estrae il Record Pace Profile alle durate target dal punto PIÙ VICINO in
 * secs[]. Lookup puro negli array paralleli, copiato riga per riga da
 * extractMMP (power-profile.ts): nessuna interpolazione (sarebbe un numero
 * inventato), il flag exact dichiara l'approssimazione.
 */
export function extractPaceProfile(
  curve: PaceCurve,
  targetSecs: readonly number[] = DEFAULT_RPP_TARGETS_SECS
): RPPPoint[] {
  return targetSecs.map((target) => {
    if (curve.secs.length === 0) {
      return {
        duration_s: target,
        actual_secs: null,
        speed_mps: null,
        pace_s_per_km: null,
        distance_m: null,
        exact: false,
      };
    }
    // Indice della durata più vicina al target (scansione lineare,
    // deterministica e a prova di refuso, come extractMMP).
    let bestIndex = 0;
    for (let i = 1; i < curve.secs.length; i++) {
      if (
        Math.abs(curve.secs[i] - target) <
        Math.abs(curve.secs[bestIndex] - target)
      ) {
        bestIndex = i;
      }
    }
    const actualSecs = curve.secs[bestIndex];
    const speedMps = plausibleSpeedMps(curve.values[bestIndex]);
    return {
      duration_s: target,
      actual_secs: actualSecs,
      speed_mps: speedMps,
      pace_s_per_km: speedMps != null ? 1000 / speedMps : null,
      distance_m: speedMps != null ? speedMps * target : null,
      exact: actualSecs === target,
    };
  });
}

// --- b) estimateCSD ----------------------------------------------------------

/**
 * Finestra di fit del modello 2 parametri della velocità critica: 2–15 min.
 * Sotto i ~2 minuti domina la componente neuromuscolare (non aerobica),
 * sopra i ~15-20 minuti la velocità decade sotto CS e il fit si sfascia.
 * Diversa dalla finestra POWER_LAW_FIT_SECS della bici (300–3600s): il
 * modello CP di riferimento per la corsa è definito lineare su questa
 * finestra più corta, non è la stessa power-law bici applicata alla corsa.
 */
const CS_FIT_SECS: readonly number[] = [120, 300, 600, 900];

export interface CSDResult {
  cs_mps: number;
  cs_pace_s_per_km: number;
  /** Distanza percorribile SOPRA CS prima di esaurirsi, in METRI (non
   * joule: non è un'energia, mai chiamarla w_prime, mai dividerla per 1000). */
  d_prime_m: number;
  /** Bontà del fit, 0–1. */
  r2: number;
  /** Durate (secondi) realmente usate nel fit, per audit. */
  fit_secs: number[];
  model: "CS_2P_LINEAR";
  source: "app_cs2p_fit";
}

/**
 * Stima Critical Speed (CS) e D′ con una regressione lineare SEMPLICE di
 * distanza su tempo: d = CS·t + D′ (slope = CS in m/s, intercept = D′ in
 * metri). Stessa struttura delle somme sx/sy/sxx/sxy e stesso guard
 * denom === 0 di estimatePowerLawCP (power-profile.ts), ma su scala LINEARE
 * e non log-log: il modello CP di riferimento per la corsa è lineare per
 * costruzione, un log-log qui sarebbe un modello diverso.
 */
export function estimateCSD(points: RPPPoint[]): CSDResult | null {
  const usable = points.filter(
    (p) =>
      CS_FIT_SECS.includes(p.duration_s) &&
      p.speed_mps != null &&
      p.distance_m != null
  );
  if (usable.length < 3) return null; // fit instabile con meno di 3 punti

  const xs = usable.map((p) => p.duration_s);
  const ys = usable.map((p) => p.distance_m as number);
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, x) => a + x * x, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null; // durate tutte uguali: nessuna regressione possibile

  const slope = (n * sxy - sx * sy) / denom; // CS in m/s
  const intercept = (sy - slope * sx) / n; // D′ in metri

  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return null;
  // CS o D′ non fisiologici (negativi o nulli): meglio nessun numero che un
  // numero falso.
  if (slope <= 0 || intercept <= 0) return null;

  const meanY = sy / n;
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0);
  const ssRes = xs.reduce(
    (a, x, i) => a + (ys[i] - (slope * x + intercept)) ** 2,
    0
  );
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  if (!Number.isFinite(r2)) return null;

  // Arrotondamenti (§4.3): cs_mps 3 decimali, cs_pace 1 decimale, d_prime
  // all'intero, r2 4 decimali. Il resto (fit_secs) resta grezzo.
  const csMps = Math.round(slope * 1000) / 1000;
  if (csMps <= 0) return null; // guard extra: mai dividere per zero sotto
  // Nessun essere umano ha una CS fuori da questa finestra (6.5 m/s vale
  // circa 2:34/km, più veloce del passo del record del mondo di maratona;
  // 1.5 m/s vale circa 11:07/km, cioè camminata). Difende dall'unità
  // sbagliata (km/h o mph letti come m/s), che il guard per-valore
  // 0.5-12 m/s non intercetta sempre.
  if (csMps < 1.5 || csMps > 6.5) return null;

  return {
    cs_mps: csMps,
    cs_pace_s_per_km: Math.round((1000 / csMps) * 10) / 10,
    d_prime_m: Math.round(intercept),
    r2: Math.round(r2 * 10000) / 10000,
    fit_secs: xs,
    model: "CS_2P_LINEAR",
    source: "app_cs2p_fit",
  };
}

// --- c) formatPace -----------------------------------------------------------

/**
 * Formatta un passo in s/km come "mm:ss". Arrotonda i secondi TOTALI prima
 * di scomporli in minuti/secondi: evita il riporto sbagliato (299.7 s/km
 * arrotondando prima i soli secondi darebbe "4:60" invece di "5:00").
 * Input null, non positivo o non finito → "—" (mai un numero inventato).
 */
export function formatPace(paceSPerKm: number | null): string {
  if (paceSPerKm == null || !Number.isFinite(paceSPerKm) || paceSPerKm <= 0) {
    return "—";
  }
  const totalSeconds = Math.round(paceSPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// --- d) buildRunnerProfile (orchestratore, decisione §1.2) ------------------

export interface RunnerProfileData {
  meta: {
    generated_at: string;
    window_days: 42 | 90;
    source: "intervals_pace_curves";
    /** Soglie euristiche v0 (§4.5): dichiararlo, da calibrare nel tempo. */
    confidence: "high" | "medium" | "low";
    thresholds_version: "v0";
  };
  rpp: Array<
    RPPPoint & { speed_mps_1y: number | null; pace_s_per_km_1y: number | null }
  >;
  cs_dprime: CSDResult | null;
}

/** Trova la curva per id, come findCurve in build-profile.ts. */
function findPaceCurve(
  curves: PaceCurvesResponse,
  id: string
): PaceCurve | null {
  return curves.list.find((c) => c.id === id) ?? null;
}

/**
 * Compone extractPaceProfile + estimateCSD in un unico oggetto
 * runner_profile_data. Curva primaria 42d → fallback 90d → fallback
 * list[0] (identico a buildAthleteProfile); 1y come riferimento per
 * speed_mps_1y/pace_s_per_km_1y. L'impurità del clock è iniettabile
 * (generatedAt) per i test, come in build-profile.ts.
 */
export function buildRunnerProfile(
  paceCurves: PaceCurvesResponse,
  generatedAt: string = new Date().toISOString()
): RunnerProfileData | null {
  if (paceCurves.list.length === 0) return null;

  const primary =
    findPaceCurve(paceCurves, "42d") ??
    findPaceCurve(paceCurves, "90d") ??
    paceCurves.list[0];
  if (!primary) return null;

  const reference1y = findPaceCurve(paceCurves, "1y");

  const rppPrimary = extractPaceProfile(primary);
  const rpp1y = reference1y ? extractPaceProfile(reference1y) : [];

  // Nessun punto utilizzabile → null: la route non deve scrivere un oggetto
  // vuoto (guard table §4.4).
  const hasUsablePoint = rppPrimary.some((p) => p.speed_mps != null);
  if (!hasUsablePoint) return null;

  const csd = estimateCSD(rppPrimary);

  const rpp: RunnerProfileData["rpp"] = rppPrimary.map((point) => {
    const ref = rpp1y.find((p) => p.duration_s === point.duration_s);
    return {
      ...point,
      speed_mps_1y: ref?.speed_mps ?? null,
      pace_s_per_km_1y: ref?.pace_s_per_km ?? null,
    };
  });

  // Confidence (soglie euristiche v0, §4.5): high richiede il fit completo
  // (4 punti, tutti esatti, r2 ≥ 0.99); medium = cs_dprime presente ma non
  // ai criteri high; low = nessun cs_dprime.
  const allFitExact =
    csd != null &&
    csd.fit_secs.every(
      (secs) => rppPrimary.find((p) => p.duration_s === secs)?.exact === true
    );
  const confidence: RunnerProfileData["meta"]["confidence"] =
    csd == null
      ? "low"
      : csd.fit_secs.length === 4 && allFitExact && csd.r2 >= 0.99
        ? "high"
        : "medium";

  return {
    meta: {
      generated_at: generatedAt,
      window_days: (primary.days ?? 42) <= 42 ? 42 : 90,
      source: "intervals_pace_curves",
      confidence,
      thresholds_version: "v0",
    },
    rpp,
    cs_dprime: csd,
  };
}

// --- e) paceZones ------------------------------------------------------------

/**
 * Zone di passo v0 (Q5): euristica NOSTRA in % della velocità critica, non
 * copiata dal Running Modeler di AnalyzeMe (le sue soglie esatte non sono
 * verificabili — vedi spec). Tabella dichiarata thresholds_version "v0" in
 * RunnerProfileData.meta, da ricalibrare nel tempo.
 */
const PACE_ZONE_TABLE: ReadonlyArray<{
  key: PaceZone["key"];
  label: string;
  pct_cs_min: number;
  pct_cs_max: number;
}> = [
  { key: "Z1", label: "Recupero", pct_cs_min: 0, pct_cs_max: 80 },
  { key: "Z2", label: "Fondo lento", pct_cs_min: 80, pct_cs_max: 88 },
  { key: "Z3", label: "Fondo medio", pct_cs_min: 88, pct_cs_max: 95 },
  { key: "Z4", label: "Soglia", pct_cs_min: 95, pct_cs_max: 102 },
  { key: "Z5", label: "VO2max", pct_cs_min: 102, pct_cs_max: 115 },
];

export interface PaceZone {
  key: "Z1" | "Z2" | "Z3" | "Z4" | "Z5";
  label: string;
  /** Estremo LENTO in % di CS (es. 80). */
  pct_cs_min: number;
  /** Estremo VELOCE in % di CS (es. 88). */
  pct_cs_max: number;
  /** Passo del limite lento (numero PIÙ ALTO: % più bassa = più lento). */
  pace_s_per_km_slow: number;
  /** Passo del limite veloce (numero PIÙ BASSO: % più alta = più veloce). */
  pace_s_per_km_fast: number;
}

/**
 * Zone v0 da % di CS (tabella Q5). [] se csd è null. Z1 è aperta verso il
 * basso (pct_cs_min 0): il passo al suo estremo lento è per costruzione
 * Infinity (nessun limite di quanto lentamente si possa "recuperare"), che
 * formatPace già rende come "—" senza bisogno di un caso speciale qui.
 */
export function paceZones(csd: CSDResult | null): PaceZone[] {
  if (csd == null) return [];
  return PACE_ZONE_TABLE.map((zone) => {
    const speedSlow = csd.cs_mps * (zone.pct_cs_min / 100);
    const speedFast = csd.cs_mps * (zone.pct_cs_max / 100);
    return {
      key: zone.key,
      label: zone.label,
      pct_cs_min: zone.pct_cs_min,
      pct_cs_max: zone.pct_cs_max,
      pace_s_per_km_slow: Math.round((1000 / speedSlow) * 10) / 10,
      pace_s_per_km_fast: Math.round((1000 / speedFast) * 10) / 10,
    };
  });
}

// --- f) predictRaceTimes ------------------------------------------------------

/** Distanze standard delle predizioni di gara (Q6): niente 21/42 km, sarebbero
 * numeri falsi oltre la finestra di fit del modello CS 2P. */
const DEFAULT_RACE_DISTANCES_M: readonly number[] = [1000, 3000, 5000, 10000];

export interface RacePrediction {
  distance_m: number;
  /** "1 km" | "3 km" | "5 km" | "10 km". */
  label: string;
  time_s: number;
  pace_s_per_km: number;
  /** false se time_s esce dalla finestra di fit 120–900s (CS_FIT_SECS):
   * stima ottimista, il modello CS 2P è tarato su sforzi di 2–15 min. */
  in_model_window: boolean;
}

/**
 * Inverte d = CS·t + D′  →  t = (d − D′)/CS. [] se csd è null. Distanze ≤ D′
 * danno un tempo negativo o nullo: il punto va scartato (No Virtual Math),
 * non mostrato come tempo negativo.
 */
export function predictRaceTimes(
  csd: CSDResult | null,
  distances: readonly number[] = DEFAULT_RACE_DISTANCES_M
): RacePrediction[] {
  if (csd == null) return [];

  const predictions: RacePrediction[] = [];
  for (const distanceM of distances) {
    const timeS = (distanceM - csd.d_prime_m) / csd.cs_mps;
    if (!Number.isFinite(timeS) || timeS <= 0) continue; // sotto D′: scartare il punto

    const roundedTimeS = Math.round(timeS);
    predictions.push({
      distance_m: distanceM,
      label: `${distanceM / 1000} km`,
      time_s: roundedTimeS,
      pace_s_per_km: Math.round((roundedTimeS / (distanceM / 1000)) * 10) / 10,
      in_model_window: roundedTimeS >= 120 && roundedTimeS <= 900,
    });
  }
  return predictions;
}
