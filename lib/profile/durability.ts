/**
 * Durabilità — funzioni pure (curva potenza da fresco vs affaticato).
 *
 * Nessuna chiamata API, nessun clock, nessun DB: stessi input → stesso
 * output, testato in tests/durability.test.ts. Stile e header copiati da
 * lib/profile/power-profile.ts (No Virtual Math: qui il "math" è dichiarato,
 * niente fit nascosti).
 *
 * Fonte: stream `watts` a 1 Hz (endpoint streams.json già verificato,
 * docs/INTERVALS_API_NOTES.md). kJ di pre-lavoro = energia cumulata dall'inizio
 * attività. Per ogni bin di kJ si misura la MMP (mean-max power) alle durate
 * di riferimento SOLO sulle finestre che iniziano dentro quel bin: il calo %
 * rispetto al bin fresco è la "durabilità".
 */

// --- Costanti v0 (da calibrare — vedi spec, non valori pubblicati) ----------

// ponytail: costanti v0, tarate a mano sulla spec; ricalibrare quando c'è un
// dataset reale di uscite lunghe con potenza.
export const LOOKBACK_DAYS = 90;
export const MAX_ACTIVITIES = 12;
export const MIN_ACTIVITIES = 3;
export const MIN_LONG_RIDE_SECS = 5400;
export const MIN_WINDOWS_PER_BIN = 60;

/** Bin di pre-lavoro kJ. Bordo alto escluso, tranne l'ultimo (open-ended). */
export const KJ_BINS = [
  { id: "fresh", min_kj: 0, max_kj: 500, label: "Fresco" },
  { id: "kj1000", min_kj: 1000, max_kj: 1500, label: "Dopo ~1000 kJ" },
  { id: "kj2000", min_kj: 2000, max_kj: Infinity, label: "Dopo ~2000 kJ" },
] as const;

/** Durate su cui misurare il calo (secondi). Sottoinsieme del RPP. */
export const DURABILITY_DURATIONS_SECS = [60, 300, 1200] as const; // 1', 5', 20'

export interface WattsStream {
  activity_id: string | number;
  /** Serie watts a 1 Hz. null/0 ammessi (buchi, tratti senza spinta). */
  watts: Array<number | null>;
}

/** MMP per (bin, durata) aggregata su più attività. */
export interface DurabilityBinResult {
  bin_id: string;
  min_kj: number;
  /** Per durata: miglior MMP trovato in quel bin su tutte le attività. */
  mmp: Array<{ duration_s: number; watts: number | null; samples: number }>;
}

export interface DurabilityResult {
  bins: DurabilityBinResult[];
  /**
   * Calo % per durata vs bin fresco, sul bin più affaticato che ha dati.
   * decline_pct negativo = calo (es. -0.08 = -8%). null se dati insufficienti.
   */
  decline: Array<{
    duration_s: number;
    /** kJ del bin usato come "affaticato" (il più alto con dati validi). */
    fatigued_bin_kj: number;
    fresh_watts: number | null;
    fatigued_watts: number | null;
    decline_pct: number | null;
  }>;
  /**
   * Indice unico 0–100. 100 = nessun calo; più basso = cala di più.
   * = round(100 · (1 + media dei decline_pct validi)). null se nessun decline.
   */
  durability_index: number | null;
  /** "high" | "medium" | "low" dalla quantità di dati (vedi criteri minimi). */
  confidence: "high" | "medium" | "low";
  meta: {
    activities_used: number;
    /** Durate di riferimento usate (per audit). */
    durations_s: number[];
    thresholds_version: "v0";
  };
}

/** Trova il bin di appartenenza per una kJ cumulata di inizio finestra. */
function findBin(
  kjStart: number,
  bins: readonly { id: string; min_kj: number; max_kj: number }[]
): { id: string; min_kj: number; max_kj: number } | null {
  return bins.find((b) => kjStart >= b.min_kj && kjStart < b.max_kj) ?? null;
}

/**
 * MMP di UNA attività per (bin kJ × durata): rolling window della potenza
 * media su `duration_s` secondi, tenuta SOLO se la kJ cumulata all'INIZIO
 * della finestra cade nel bin. Ritorna il massimo per ogni (bin, durata).
 *
 * Prefix-sum su watts (null→0) per il cumulo O(N), poi finestre O(1) ognuna.
 */
export function activityBinnedMMP(
  stream: WattsStream,
  bins: typeof KJ_BINS = KJ_BINS,
  durations: readonly number[] = DURABILITY_DURATIONS_SECS
): Array<{ bin_id: string; duration_s: number; watts: number | null; samples: number }> {
  const watts = stream.watts;
  const n = watts.length;

  // prefix[i] = somma di watts[0..i-1] (0-based, prefix[0] = 0).
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    prefix[i + 1] = prefix[i] + (watts[i] ?? 0);
  }

  // best[bin_id][duration_s] = { watts, samples }
  const best = new Map<string, Map<number, { watts: number; samples: number }>>();
  for (const bin of bins) best.set(bin.id, new Map());

  for (const duration of durations) {
    for (let s = 0; s + duration <= n; s++) {
      const kjStart = prefix[s] / 1000;
      const bin = findBin(kjStart, bins);
      if (!bin) continue;
      const mmp = (prefix[s + duration] - prefix[s]) / duration;

      const perDuration = best.get(bin.id)!;
      const current = perDuration.get(duration);
      if (!current) {
        perDuration.set(duration, { watts: mmp, samples: 1 });
      } else {
        current.samples += 1;
        if (mmp > current.watts) current.watts = mmp;
      }
    }
  }

  const result: Array<{
    bin_id: string;
    duration_s: number;
    watts: number | null;
    samples: number;
  }> = [];
  for (const bin of bins) {
    const perDuration = best.get(bin.id)!;
    for (const duration of durations) {
      const found = perDuration.get(duration);
      result.push({
        bin_id: bin.id,
        duration_s: duration,
        watts: found ? Math.round(found.watts) : null,
        samples: found?.samples ?? 0,
      });
    }
  }
  return result;
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

/**
 * Aggrega più attività: per ogni (bin, durata) prende il MAX tra le attività
 * (best effort), calcola i decline vs fresco e l'indice. Deterministica.
 */
export function buildDurability(
  streams: WattsStream[],
  durations: readonly number[] = DURABILITY_DURATIONS_SECS
): DurabilityResult {
  // agg[bin_id][duration_s] = { watts, samples }
  const agg = new Map<string, Map<number, { watts: number | null; samples: number }>>();
  for (const bin of KJ_BINS) {
    const perDuration = new Map<number, { watts: number | null; samples: number }>();
    for (const duration of durations) perDuration.set(duration, { watts: null, samples: 0 });
    agg.set(bin.id, perDuration);
  }

  for (const stream of streams) {
    const perActivity = activityBinnedMMP(stream, KJ_BINS, durations);
    for (const entry of perActivity) {
      const perDuration = agg.get(entry.bin_id)!;
      const current = perDuration.get(entry.duration_s)!;
      current.samples += entry.samples;
      if (entry.watts != null && (current.watts == null || entry.watts > current.watts)) {
        current.watts = entry.watts;
      }
    }
  }

  // Validità: samples >= MIN_WINDOWS_PER_BIN, altrimenti watts = null.
  const bins: DurabilityBinResult[] = KJ_BINS.map((bin) => {
    const perDuration = agg.get(bin.id)!;
    return {
      bin_id: bin.id,
      min_kj: bin.min_kj,
      mmp: durations.map((duration) => {
        const entry = perDuration.get(duration)!;
        const valid = entry.samples >= MIN_WINDOWS_PER_BIN;
        return {
          duration_s: duration,
          watts: valid ? entry.watts : null,
          samples: entry.samples,
        };
      }),
    };
  });

  const freshBin = bins.find((b) => b.bin_id === "fresh")!;
  // Bin affaticato più alto con dati: kj2000 se ha almeno una durata valida,
  // altrimenti kj1000, altrimenti nessun decline.
  const kj2000Bin = bins.find((b) => b.bin_id === "kj2000")!;
  const kj1000Bin = bins.find((b) => b.bin_id === "kj1000")!;
  const fatiguedBin = kj2000Bin.mmp.some((m) => m.watts != null)
    ? kj2000Bin
    : kj1000Bin.mmp.some((m) => m.watts != null)
      ? kj1000Bin
      : null;

  const decline: DurabilityResult["decline"] = durations.map((duration) => {
    const fresh = freshBin.mmp.find((m) => m.duration_s === duration)?.watts ?? null;
    const fatiguedWatts = fatiguedBin?.mmp.find((m) => m.duration_s === duration)?.watts ?? null;
    const declinePct =
      fresh != null && fresh > 0 && fatiguedWatts != null
        ? round4(fatiguedWatts / fresh - 1)
        : null;
    return {
      duration_s: duration,
      fatigued_bin_kj: fatiguedBin?.min_kj ?? 0,
      fresh_watts: fresh,
      fatigued_watts: fatiguedWatts,
      decline_pct: declinePct,
    };
  });

  // Indice: media dei decline_pct validi, clampata a [-0.5, 0], poi 100·(1+avg).
  const validDeclines = decline
    .map((d) => d.decline_pct)
    .filter((d): d is number => d != null);
  const durabilityIndex =
    validDeclines.length > 0
      ? Math.round(
          100 *
            (1 +
              Math.max(
                -0.5,
                Math.min(0, validDeclines.reduce((a, b) => a + b, 0) / validDeclines.length)
              ))
        )
      : null;

  // Confidence (vedi spec §8): high ≥6 attività + tutte e 3 le durate valide;
  // medium ≥3 attività + almeno il decline a 1200s valido; altrimenti low.
  const activitiesUsed = streams.length;
  const decline1200Valid = decline.find((d) => d.duration_s === 1200)?.decline_pct != null;
  const allDurationsValid = decline.every((d) => d.decline_pct != null);
  const confidence: DurabilityResult["confidence"] =
    activitiesUsed >= 6 && allDurationsValid
      ? "high"
      : activitiesUsed >= 3 && decline1200Valid
        ? "medium"
        : "low";

  return {
    bins,
    decline,
    durability_index: durabilityIndex,
    confidence,
    meta: {
      activities_used: activitiesUsed,
      durations_s: [...durations],
      thresholds_version: "v0",
    },
  };
}
