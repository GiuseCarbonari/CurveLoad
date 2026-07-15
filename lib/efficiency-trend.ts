/**
 * Trend di efficienza aerobica (W/battito) — ciclismo, v1.
 *
 * computeEfficiencyTrend() è una FUNZIONE PURA e deterministica: stessi
 * input → stesso output, nessuna chiamata API, nessun accesso a clock o DB.
 * Segue lo stile di lib/readiness.ts (funzioni pure + tipi esportati).
 *
 * Scope v1 = SOLO CICLISMO. La corsa è fuori scope: le attività sincronizzate
 * non hanno un passo medio affidabile per seduta (vedi spec).
 *
 * Formula: efficiency = icu_weighted_avg_watts / average_heartrate (W per
 * battito). Un valore più alto = più watt per battito = più efficiente.
 */

import type { IntervalsActivity } from "@/lib/intervals-client";

const RIDE_TYPES = new Set(["Ride", "VirtualRide", "GravelRide", "MountainBikeRide"]);
const MIN_MOVING_TIME_S = 1800; // 30 min, coerente con lib/terrain/velocity-signature.ts
const WEEKS_WINDOW = 8;
const MIN_WEEKS_FOR_TREND = 3;
const TREND_THRESHOLD_PCT = 1.5;
const OUTLIER_MULTIPLIER = 2;

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
}

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

/** Lunedì della settimana ISO della data locale fornita (YYYY-MM-DD). */
function isoWeekStart(dateStr: string): string {
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

/** Calcola il trend completo dalle attività grezze del mirror. */
export function computeEfficiencyTrend(
  activities: IntervalsActivity[]
): EfficiencyTrend {
  const valid = filterEnduranceRides(activities);

  const byWeek = new Map<string, number[]>();
  for (const activity of valid) {
    const weekStart = isoWeekStart(activity.start_date_local);
    const efficiency = activityEfficiency(activity)!;
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
    summary:
      "Servono più uscite in bici con potenza e frequenza cardiaca per calcolare la tendenza.",
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
    summary =
      "Ultimamente servono più battiti per gli stessi watt: efficienza in calo. Può dipendere da fatica, caldo o poche uscite lunghe.";
  } else {
    interpretation = "stabile";
    summary = "La tua efficienza aerobica è stabile nelle ultime settimane.";
  }

  return { points, slopePct: Math.round(slopePct * 100) / 100, interpretation, summary };
}
