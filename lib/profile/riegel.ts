/**
 * Formula di Riegel (1977) per le previsioni di gara da RISULTATI VERI.
 *
 * Diverso dal motore CS/D′ (pace-profile.ts): quello fitta la curva di
 * ALLENAMENTO (2-15 min) e si ferma apposta prima di mezza/maratona. Riegel
 * lavora da UN risultato di gara reale e copre proprio le distanze lunghe
 * che CS/D′ rifiuta di stimare — i due motori non si sostituiscono, si
 * completano (vedi runner-pacing-panel.tsx, che li mostra fianco a fianco).
 *
 * T2 = T1 * (D2/D1)^k. k standard = 1.06. Con 2+ gare su distanze diverse si
 * può risolvere k PERSONALE: k = ln(T2/T1) / ln(D2/D1).
 *
 * `livello_preparazione` (auto-dichiarato dall'atleta) non entra MAI nella
 * formula: è metadata da mostrare accanto al numero, mai un coefficiente.
 * Un k disperso fra le coppie è informazione (probabile allenamento/pacing
 * non equivalenti fra le gare), non un errore da correggere filtrando.
 */

export type LivelloPreparazione = "ben_allenato" | "nella_media" | "sottopreparato";

/** Sottoinsieme di campi richiesto dal motore: RaceResultItem (UI) è compatibile per struttura. */
export interface RaceResult {
  data: string; // YYYY-MM-DD
  distanza_km: number;
  tempo_finale_s: number;
  livello_preparazione: string | null;
}

export const STANDARD_K = 1.06;

/** Finestra di calibrazione dichiarata da Riegel (1977): ~3.5-230 minuti. */
const RIEGEL_MIN_S = 210;
const RIEGEL_MAX_S = 13800;

/** Sotto questo rapporto fra le due distanze, k diventa numericamente instabile: poco rumore sul tempo lo fa impazzire. */
const MIN_DISTANCE_RATIO = 1.15;

/** Fuori da questo range k è quasi certamente un errore di dato (tempo/distanza sbagliati), non fisiologia reale. */
const K_MIN = 0.85;
const K_MAX = 1.3;

/** Le quattro distanze "classiche" — apposta le stesse che CS/D′ esclude, è lì che Riegel aggiunge copertura. */
export const DEFAULT_TARGET_DISTANCES_KM: readonly number[] = [5, 10, 21.0975, 42.195];

export interface RiegelPrediction {
  targetDistanceKm: number;
  predictedTimeSeconds: number;
  exponent: number;
  /** true se base o target cadono fuori dalla finestra 3.5-230min: tetto teorico, non obiettivo. */
  extrapolated: boolean;
}

function computePrediction(
  baseDistanceKm: number,
  baseTimeSeconds: number,
  targetDistanceKm: number,
  k: number
): RiegelPrediction | null {
  if (
    !(baseDistanceKm > 0) ||
    !(baseTimeSeconds > 0) ||
    !(targetDistanceKm > 0) ||
    !Number.isFinite(k)
  ) {
    return null;
  }
  const predicted = baseTimeSeconds * Math.pow(targetDistanceKm / baseDistanceKm, k);
  if (!Number.isFinite(predicted) || predicted <= 0) return null;

  const predictedTimeSeconds = Math.round(predicted);
  const outOfWindow = (s: number) => s < RIEGEL_MIN_S || s > RIEGEL_MAX_S;
  return {
    targetDistanceKm,
    predictedTimeSeconds,
    exponent: k,
    extrapolated: outOfWindow(baseTimeSeconds) || outOfWindow(predictedTimeSeconds),
  };
}

/** Previsione Riegel standard (k=1.06) da UNA gara reale verso una distanza target. */
export function standardRiegelPrediction(
  race: { distanceKm: number; timeSeconds: number },
  targetDistanceKm: number
): RiegelPrediction | null {
  return computePrediction(race.distanceKm, race.timeSeconds, targetDistanceKm, STANDARD_K);
}

/** Stessa proiezione con un k personale già calcolato (personalKFromRaces) invece di quello standard. */
export function predictWithPersonalK(
  race: { distanceKm: number; timeSeconds: number },
  k: number,
  targetDistanceKm: number
): RiegelPrediction | null {
  return computePrediction(race.distanceKm, race.timeSeconds, targetDistanceKm, k);
}

export interface RejectedPair {
  a: RaceResult;
  b: RaceResult;
  reason: "too_close" | "out_of_range";
}

export interface PersonalKResult {
  /** Media dei k validi (unico valore se sono 2 gare, media se 3+). */
  k: number;
  /** null con solo 2 gare (una sola coppia, nessun range da mostrare). */
  kMin: number | null;
  kMax: number | null;
  pairsUsed: number;
  rejectedPairs: RejectedPair[];
}

/**
 * Esponente personale da tutte le coppie di gare valide. null se meno di 2
 * gare, o se nessuna coppia supera i guardrail (rapporto distanze, range k).
 * Guarda TUTTE le coppie (non solo quella più distante), come richiesto dal
 * prompt esterno: con 3+ gare il range mostra se l'atleta è consistente o
 * disperso — dispersione che riflette allenamento/pacing, non un bug.
 */
export function personalKFromRaces(races: RaceResult[]): PersonalKResult | null {
  const valid = races.filter((r) => r.distanza_km > 0 && r.tempo_finale_s > 0);
  if (valid.length < 2) return null;

  const ks: number[] = [];
  const rejectedPairs: RejectedPair[] = [];

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const [small, large] =
        valid[i].distanza_km <= valid[j].distanza_km
          ? [valid[i], valid[j]]
          : [valid[j], valid[i]];
      const ratio = large.distanza_km / small.distanza_km;
      if (ratio < MIN_DISTANCE_RATIO) {
        rejectedPairs.push({ a: valid[i], b: valid[j], reason: "too_close" });
        continue;
      }
      const k =
        Math.log(large.tempo_finale_s / small.tempo_finale_s) /
        Math.log(large.distanza_km / small.distanza_km);
      if (!Number.isFinite(k) || k < K_MIN || k > K_MAX) {
        rejectedPairs.push({ a: valid[i], b: valid[j], reason: "out_of_range" });
        continue;
      }
      ks.push(k);
    }
  }

  if (ks.length === 0) return null;

  const mean = ks.reduce((sum, v) => sum + v, 0) / ks.length;
  return {
    k: Math.round(mean * 1000) / 1000,
    kMin: ks.length > 1 ? Math.round(Math.min(...ks) * 1000) / 1000 : null,
    kMax: ks.length > 1 ? Math.round(Math.max(...ks) * 1000) / 1000 : null,
    pairsUsed: ks.length,
    rejectedPairs,
  };
}

function mostRecentRace(races: RaceResult[]): RaceResult | null {
  if (races.length === 0) return null;
  return [...races].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))[0];
}

export interface RiegelSummary {
  /** Gara usata come base per tutte le proiezioni: la più recente. */
  baseRace: RaceResult | null;
  standard: RiegelPrediction[];
  personalK: PersonalKResult | null;
  /** [] se personalK è null (serve almeno una coppia valida). */
  personal: RiegelPrediction[];
}

/**
 * Compone tutto quello che il pannello UI deve mostrare da un elenco di
 * gare grezze: previsione standard e (se possibile) personale sulle
 * distanze target, sempre proiettate dalla gara più recente.
 */
export function buildRiegelSummary(
  races: RaceResult[],
  targetDistancesKm: readonly number[] = DEFAULT_TARGET_DISTANCES_KM
): RiegelSummary {
  const baseRace = mostRecentRace(races);
  const base = baseRace
    ? { distanceKm: baseRace.distanza_km, timeSeconds: baseRace.tempo_finale_s }
    : null;

  const standard = base
    ? targetDistancesKm
        .map((d) => standardRiegelPrediction(base, d))
        .filter((p): p is RiegelPrediction => p != null)
    : [];

  const personalK = personalKFromRaces(races);
  const personal =
    personalK && base
      ? targetDistancesKm
          .map((d) => predictWithPersonalK(base, personalK.k, d))
          .filter((p): p is RiegelPrediction => p != null)
      : [];

  return { baseRace, standard, personalK, personal };
}
