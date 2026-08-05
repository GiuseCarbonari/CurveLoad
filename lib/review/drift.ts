/**
 * Deriva dagli stream 1 Hz (frequenza cardiaca + sforzo) — l'unica matematica
 * davvero nuova della review. Funzioni PURE: prendono array già scaricati,
 * nessuna chiamata Intervals qui dentro (quella vive nell'orchestratore I/O).
 *
 * No Virtual Math: sotto la soglia minima di campioni, o senza zone FC reali,
 * il risultato è `null` — mai un numero stimato per riempire un buco.
 */

/** 20 min a 1Hz — stessa soglia minima usata per il fondo lento in efficiency-trend.ts. */
const MIN_SAMPLES_FOR_DECOUPLING = 1200;

export interface DecouplingResult {
  /** % di peggioramento efficienza (sforzo/battito) dalla prima alla seconda metà. Positivo = drift. Null = dati insufficienti. */
  decouplingPct: number | null;
  sampleCount: number;
}

/**
 * Decoupling Pw:HR (bici, `effort` = watts) o Pa:HR (corsa, `effort` =
 * velocity_smooth in m/s): confronta sforzo/battito medio nella prima metà
 * dell'uscita con la seconda. Positivo = il cuore sale a parità di sforzo
 * (o lo sforzo cala a parità di cuore) andando avanti nella seduta.
 */
export function computeDecoupling(
  heartrate: Array<number | null>,
  effort: Array<number | null>
): DecouplingResult {
  const n = Math.min(heartrate.length, effort.length);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const hr = heartrate[i];
    const ef = effort[i];
    if (hr != null && hr > 0 && ef != null && ef > 0) pairs.push([ef, hr]);
  }
  if (pairs.length < MIN_SAMPLES_FOR_DECOUPLING) {
    return { decouplingPct: null, sampleCount: pairs.length };
  }

  const mid = Math.floor(pairs.length / 2);
  const avgRatio = (half: Array<[number, number]>): number => {
    const avgEffort = half.reduce((sum, [e]) => sum + e, 0) / half.length;
    const avgHr = half.reduce((sum, [, h]) => sum + h, 0) / half.length;
    return avgEffort / avgHr;
  };
  const efFirst = avgRatio(pairs.slice(0, mid));
  const efSecond = avgRatio(pairs.slice(mid));
  if (efFirst === 0) return { decouplingPct: null, sampleCount: pairs.length };

  const pct = ((efFirst - efSecond) / efFirst) * 100;
  return { decouplingPct: Math.round(pct * 10) / 10, sampleCount: pairs.length };
}

export interface EasyCeilingResult {
  /** Frazione 0-1 del tempo passato sopra il tetto della zona aerobica facile. Null = zone FC non disponibili. */
  aboveEasyCeilingFraction: number | null;
  /** bpm del tetto usato (2° confine di sportSettings.hr_zones — "Aerobic" su Intervals). */
  easyCeilingBpm: number | null;
  sampleCount: number;
}

/**
 * % di tempo sopra il tetto della zona "facile" (2° confine delle zone FC
 * reali dell'atleta, da Intervals.icu — non una soglia inventata). Risponde
 * a "questa uscita prevista facile lo è stata davvero?".
 */
export function computeTimeAboveEasyCeiling(
  heartrate: Array<number | null>,
  hrZones: number[] | null
): EasyCeilingResult {
  if (hrZones == null || hrZones.length < 2) {
    return { aboveEasyCeilingFraction: null, easyCeilingBpm: null, sampleCount: 0 };
  }
  const ceiling = hrZones[1];
  const valid = heartrate.filter((v): v is number => v != null && v > 0);
  if (valid.length === 0) {
    return { aboveEasyCeilingFraction: null, easyCeilingBpm: ceiling, sampleCount: 0 };
  }
  const above = valid.filter((v) => v > ceiling).length;
  return {
    aboveEasyCeilingFraction: Math.round((above / valid.length) * 1000) / 1000,
    easyCeilingBpm: ceiling,
    sampleCount: valid.length,
  };
}
