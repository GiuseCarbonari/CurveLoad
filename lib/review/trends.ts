/**
 * Tendenze fra le ultime review — funzione pura. Ogni tendenza esce SOLO con
 * la sua prova (numeri e date): nessuna frase-tendenza senza i dati che la
 * sostengono, stessa disciplina di computeEfficiencyTrend
 * (lib/efficiency-trend.ts, MIN_WEEKS_FOR_TREND).
 */

const MIN_POINTS_FOR_TREND = 3;
/** Sotto questa variazione assoluta di punti percentuali non si parla di "tendenza". */
const MIN_DELTA_PCT_POINTS = 15;

export interface HardSessionTrendPoint {
  weekStart: string;
  hardPlanned: number;
  hardCompleted: number;
}

export interface ReviewTrend {
  code: string;
  text: string;
}

/**
 * Tendenza di esecuzione delle sedute dure fra le ultime review con almeno
 * una dura pianificata. Confronta il PRIMO e l'ULTIMO punto della finestra
 * (ordine cronologico): serve un'evidenza chiara e datata, non un fit.
 */
export function hardSessionTrend(points: HardSessionTrendPoint[]): ReviewTrend | null {
  const withPlans = points.filter((p) => p.hardPlanned > 0);
  if (withPlans.length < MIN_POINTS_FOR_TREND) return null;

  const sorted = [...withPlans].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const firstRate = first.hardCompleted / first.hardPlanned;
  const lastRate = last.hardCompleted / last.hardPlanned;
  const deltaPctPoints = Math.round((lastRate - firstRate) * 100);

  if (Math.abs(deltaPctPoints) < MIN_DELTA_PCT_POINTS) return null;

  const direction = deltaPctPoints > 0 ? "in miglioramento" : "in calo";
  return {
    code: "hard_session_trend",
    text: `Esecuzione delle sedute dure ${direction}: dal ${Math.round(firstRate * 100)}% (${first.weekStart}) al ${Math.round(lastRate * 100)}% (${last.weekStart}).`,
  };
}
