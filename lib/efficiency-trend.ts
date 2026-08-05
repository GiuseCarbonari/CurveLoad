/**
 * Trend di efficienza aerobica — ciclismo (W/battito) e corsa (m/battito).
 *
 * computeEfficiencyTrend() è una FUNZIONE PURA e deterministica: stessi
 * input → stesso output, nessuna chiamata API, nessun accesso a clock o DB.
 * Segue lo stile di lib/readiness.ts (funzioni pure + tipi esportati).
 *
 * Bici: efficiency = icu_weighted_avg_watts / average_heartrate (W per
 * battito). Un valore più alto = più watt per battito = più efficiente.
 *
 * Corsa: efficiency = (distance/moving_time)*60/average_heartrate (metri per
 * battito, stessa scala 1.0-1.6 dei W/bpm bici). `IntervalsActivity` ha
 * `distance` e `moving_time` (lib/intervals-client.ts, ACTIVITY_FIELDS) da
 * sempre: il passo medio per seduta esiste già nei mirror salvati, nessuna
 * migrazione o nuova sync richiesta. Quello che NON esiste è il dislivello
 * per attività, quindi qui è un passo grezzo, non un GAP.
 */

import type { IntervalsActivity } from "@/lib/intervals-client";

const RIDE_TYPES = new Set(["Ride", "VirtualRide", "GravelRide", "MountainBikeRide"]);
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const MIN_MOVING_TIME_S = 1800; // 30 min, coerente con lib/terrain/velocity-signature.ts
const MIN_RUN_MOVING_TIME_S = 1200; // 20 min: il fondo lento di un corridore spesso sta sotto i 30 min
const WEEKS_WINDOW = 8;
const MIN_WEEKS_FOR_TREND = 3;
const TREND_THRESHOLD_PCT = 1.5;
const OUTLIER_MULTIPLIER = 2;

// Guard di plausibilità velocità MEDIA di seduta per la corsa: più stretto
// del range 0.5-12 m/s di pace-profile.ts (quello vale per i PICCHI della
// curva di passo, non per una media di un'intera uscita). Una media sopra
// 8 m/s non è corsa umana su una seduta intera.
const MIN_RUN_SPEED_MPS = 0.5;
const MAX_RUN_SPEED_MPS = 8;

/** Punto settimanale del trend di efficienza. */
export interface WeeklyEfficiencyPoint {
  /** Lunedì della settimana ISO, YYYY-MM-DD. */
  weekStart: string;
  /** Etichetta breve "12 giu" per l'asse X. */
  label: string;
  /** Efficienza media della settimana (W/battito), 3 decimali. */
  efficiency: number;
  /** Numero di attività valide nella settimana. */
  count: number;
}

export type EfficiencyInterpretation =
  | "in miglioramento"
  | "stabile"
  | "in calo"
  | "dati insufficienti";

export interface EfficiencyTrend {
  points: WeeklyEfficiencyPoint[];
  /** Pendenza in %/settimana; null se dati insufficienti. */
  slopePct: number | null;
  interpretation: EfficiencyInterpretation;
  /** Frase completa in italiano semplice, pronta da mostrare. */
  summary: string;
  /** "Watt per battito" | "Metri per battito" — titolo pronto da mostrare. */
  title: string;
  /** "W/bpm" | "m/battito" — unità accanto al valore. */
  unit: string;
}

export type EfficiencySport = "bike" | "run";

const SPORT_LABELS: Record<
  EfficiencySport,
  { title: string; unit: string; insufficientSummary: string; declineSummary: string }
> = {
  bike: {
    title: "Watt per battito",
    unit: "W/bpm",
    insufficientSummary:
      "Servono più uscite in bici con potenza e frequenza cardiaca per calcolare la tendenza.",
    declineSummary:
      "Ultimamente servono più battiti per gli stessi watt: efficienza in calo. Può dipendere da fatica, caldo o poche uscite lunghe.",
  },
  run: {
    title: "Metri per battito",
    unit: "m/battito",
    insufficientSummary:
      "Servono più corse con frequenza cardiaca per calcolare la tendenza.",
    declineSummary:
      "Ultimamente servono più battiti per la stessa andatura: efficienza in calo. Può dipendere da fatica, caldo o poche uscite lunghe.",
  },
};

/** Media aritmetica dei valori non-null; null se non ce ne sono. */
function meanOf(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

/** Mediana dei valori (array non vuoto assunto dal chiamante). */
function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Lunedì della settimana ISO della data locale fornita (YYYY-MM-DD). Esportata per lib/review. */
export function isoWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T12:00:00`);
  const day = d.getDay(); // 0 = domenica, 1 = lunedì, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

/** Etichetta breve "12 giu" per l'asse X, stessa formattazione di condition-trend-chart.tsx. */
function formatWeekLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
}

/** Efficienza di una singola attività o null se non valida. Esportata per i test. */
export function activityEfficiency(a: IntervalsActivity): number | null {
  const watts = a.icu_weighted_avg_watts;
  const hr = a.average_heartrate;
  if (watts == null || watts <= 0 || hr == null || hr <= 0) return null;
  return Math.round((watts / hr) * 1000) / 1000;
}

/** Filtra le attività ciclismo endurance valide (criteri della spec). */
export function filterEnduranceRides(
  activities: IntervalsActivity[]
): IntervalsActivity[] {
  const candidates = activities.filter((a) => {
    if (a.type == null || !RIDE_TYPES.has(a.type)) return false;
    if (a.moving_time == null || a.moving_time < MIN_MOVING_TIME_S) return false;
    return activityEfficiency(a) != null;
  });

  if (candidates.length === 0) return [];

  const efficiencies = candidates.map((a) => activityEfficiency(a)!);
  const median = medianOf(efficiencies);
  const cutoff = median * OUTLIER_MULTIPLIER;

  return candidates.filter((a) => activityEfficiency(a)! <= cutoff);
}

/** Metri per battito di una singola attività di corsa, o null se non valida.
 *  (distance/moving_time)*60/average_heartrate. Esportata per i test. */
export function activityPaceEfficiency(a: IntervalsActivity): number | null {
  const distance = a.distance;
  const movingTime = a.moving_time;
  const hr = a.average_heartrate;
  if (distance == null || distance <= 0) return null;
  if (movingTime == null || movingTime <= 0) return null;
  if (hr == null || hr <= 0) return null;
  const speedMps = distance / movingTime;
  if (speedMps < MIN_RUN_SPEED_MPS || speedMps > MAX_RUN_SPEED_MPS) return null;
  return Math.round(((speedMps * 60) / hr) * 1000) / 1000;
}

/** Filtra le attività di corsa endurance valide (stessi criteri della bici:
 *  tipo, durata minima, outlier — vedi Q3 per MIN_RUN_MOVING_TIME_S). */
export function filterEnduranceRuns(
  activities: IntervalsActivity[]
): IntervalsActivity[] {
  const candidates = activities.filter((a) => {
    if (a.type == null || !RUN_TYPES.has(a.type)) return false;
    if (a.moving_time == null || a.moving_time < MIN_RUN_MOVING_TIME_S) return false;
    return activityPaceEfficiency(a) != null;
  });

  if (candidates.length === 0) return [];

  const efficiencies = candidates.map((a) => activityPaceEfficiency(a)!);
  const median = medianOf(efficiencies);
  const cutoff = median * OUTLIER_MULTIPLIER;

  return candidates.filter((a) => activityPaceEfficiency(a)! <= cutoff);
}

/** Calcola il trend completo dalle attività grezze del mirror.
 *  sport di default "bike": comportamento identico a prima dell'aggiunta
 *  della corsa, nessuna regressione. */
export function computeEfficiencyTrend(
  activities: IntervalsActivity[],
  sport: EfficiencySport = "bike"
): EfficiencyTrend {
  const labels = SPORT_LABELS[sport];
  const valid =
    sport === "run" ? filterEnduranceRuns(activities) : filterEnduranceRides(activities);
  const efficiencyOf = sport === "run" ? activityPaceEfficiency : activityEfficiency;

  const byWeek = new Map<string, number[]>();
  for (const activity of valid) {
    const weekStart = isoWeekStart(activity.start_date_local);
    const efficiency = efficiencyOf(activity)!;
    const bucket = byWeek.get(weekStart);
    if (bucket) bucket.push(efficiency);
    else byWeek.set(weekStart, [efficiency]);
  }

  const points: WeeklyEfficiencyPoint[] = Array.from(byWeek.entries())
    .map(([weekStart, values]) => ({
      weekStart,
      label: formatWeekLabel(weekStart),
      efficiency: Math.round((meanOf(values) ?? 0) * 1000) / 1000,
      count: values.length,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-WEEKS_WINDOW);

  const insufficient = (): EfficiencyTrend => ({
    points,
    slopePct: null,
    interpretation: "dati insufficienti",
    summary: labels.insufficientSummary,
    title: labels.title,
    unit: labels.unit,
  });

  if (points.length < MIN_WEEKS_FOR_TREND) return insufficient();

  const n = points.length;
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.efficiency);
  const xMean = meanOf(xs)!;
  const yMean = meanOf(ys)!;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    numerator += dx * (ys[i] - yMean);
    denominator += dx * dx;
  }

  if (denominator === 0 || yMean === 0) return insufficient();

  const slope = numerator / denominator;
  const slopePct = (slope / yMean) * 100;

  let interpretation: EfficiencyInterpretation;
  let summary: string;
  if (slopePct >= TREND_THRESHOLD_PCT) {
    interpretation = "in miglioramento";
    summary =
      "Stai andando più forte a parità di sforzo del cuore: efficienza in miglioramento nelle ultime settimane.";
  } else if (slopePct <= -TREND_THRESHOLD_PCT) {
    interpretation = "in calo";
    summary = labels.declineSummary;
  } else {
    interpretation = "stabile";
    summary = "La tua efficienza aerobica è stabile nelle ultime settimane.";
  }

  return {
    points,
    slopePct: Math.round(slopePct * 100) / 100,
    interpretation,
    summary,
    title: labels.title,
    unit: labels.unit,
  };
}
