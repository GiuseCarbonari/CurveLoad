/**
 * Soglie di readiness calibrate sulla storia del singolo atleta.
 *
 * Perché esiste: `lib/readiness.ts` classifica i segnali con numeri fissi
 * uguali per tutti (HRV −10%/−20% vs media 7 giorni, FC riposo +3/+5 bpm,
 * sonno 7h/5h). Sono soglie prese in prestito dalla letteratura su popolazioni
 * generiche: su un singolo atleta producono falsi allarmi, e un allarme che
 * suona senza motivo è un allarme che l'atleta smette di leggere.
 *
 * Questo modulo NON tocca la priority ladder P0–P3 (Section 11): produce solo
 * le soglie che la ladder userà. Se la storia è troppo corta o troppo rada
 * torna soglie nulle e `readiness.ts` continua a usare quelle fisse di prima.
 * Funzione pura: stessi input → stesse soglie, nessun accesso a DB o clock.
 *
 * Metodo HRV (fonti in docs/RECOVERY_SCIENCE.md):
 *  - si lavora su ln(rMSSD), non sul valore grezzo: rMSSD è log-normale, una
 *    variazione percentuale sul grezzo sovrastima i cali (Plews 2013);
 *  - il segnale è la MEDIA MOBILE a 7 giorni, non il valore di oggi: il dato
 *    giornaliero oscilla troppo per decidere qualcosa (Plews 2013);
 *  - il "normale" è quello dell'atleta: media ±1 SD del periodo precedente,
 *    non una percentuale universale;
 *  - servono almeno 3 misure a settimana perché la media regga (Plews 2014);
 *  - un CV che collassa mentre la media scende è un marker precoce di
 *    non-functional overreaching (Plews 2012) → avviso, mai uno stop.
 */

import { HRV_PROTOCOL_LABELS, hrvValue, type HrvProtocol } from "@/lib/hrv";
import type {
  ReadinessInputDay,
  ReadinessSignal,
  SignalStatus,
} from "@/lib/readiness";

/** Finestra del segnale HRV: media mobile a 7 giorni (Plews 2013). */
const HRV_WINDOW_DAYS = 7;
/** Compliance minima nella finestra perché la media sia utilizzabile (Plews 2014). */
const MIN_MEASURES_IN_WINDOW = 3;
/**
 * Misure minime nel periodo di riferimento per stimare media e SD personali.
 * Con la finestra wellness a 60 giorni il riferimento è di ~53 giorni: 14
 * misure sono raggiungibili anche misurando 3 volte a settimana, che è la
 * soglia di validità della letteratura (Plews 2014). Con la vecchia finestra
 * a 30 giorni servivano di fatto 4 misure/settimana, e chi ne faceva 3 non
 * arrivava MAI alle soglie personali.
 */
const MIN_BASELINE_MEASURES = 14;
/**
 * Notti misurate minime per calcolare la soglia sonno personale.
 *
 * Bassa apposta: per una mediana 7 valori bastano, e sotto questa soglia non
 * c'è nessun ripiego da usare. Le ore dichiarate a mano non esistono più —
 * quando Intervals ha le notti vince la mediana comunque, e quando non le ha
 * `sleepSecs` è null, il segnale sonno è "non disponibile" e la soglia non
 * viene applicata a niente. Un campo il cui valore non viene mai usato è
 * peggio di un campo assente: fa credere all'atleta che la sua risposta conti.
 */
const MIN_SLEEP_NIGHTS = 7;
/** Scostamenti dal normale personale, in deviazioni standard. */
const AMBER_SD = 1;
const RED_SD = 1.5;
/** Il CV della finestra sotto questa frazione del CV di riferimento = collasso. */
const CV_COLLAPSE_RATIO = 0.5;
/** Pavimenti in bpm sulle soglie FC riposo: con SD piccola non basta ±1 SD. */
const RHR_AMBER_FLOOR_BPM = 2;
const RHR_RED_FLOOR_BPM = 4;

/** Soglie fisse di oggi, usate quando non c'è storia sufficiente. */
export const FIXED_SLEEP_AMBER_HOURS = 7;
export const FIXED_SLEEP_RED_HOURS = 5;
export const FIXED_ACWR_AMBER = 1.3;
export const FIXED_ACWR_RED = 1.5;

/** Come l'atleta tende a strafare: seleziona l'avvertenza da mostrargli. */
export type OverreachStyle =
  | "volume_troppo_in_fretta"
  | "mai_salto_una_dura"
  | "gara_in_allenamento"
  | "ignoro_i_segnali";

/**
 * Risposte dell'atleta sui propri input di recupero (card in impostazioni).
 * Salvate verbatim in `athlete_profiles.preferences.recovery`: la forma del
 * JSONB è identica a questo tipo, così non serve nessun layer di mappatura.
 */
export interface RecoveryInputs {
  traccia_hrv: "mattina" | "saltuario" | "no" | null;
  /** 1 = nessuno stress fuori dallo sport, 5 = molto alto. */
  stress_vita: 1 | 2 | 3 | 4 | 5 | null;
  infortuni_ricorrenti: boolean;
  stile_strafare: OverreachStyle | null;
}

export const EMPTY_RECOVERY_INPUTS: RecoveryInputs = {
  traccia_hrv: null,
  stress_vita: null,
  infortuni_ricorrenti: false,
  stile_strafare: null,
};

const OVERREACH_STYLES: OverreachStyle[] = [
  "volume_troppo_in_fretta",
  "mai_salto_una_dura",
  "gara_in_allenamento",
  "ignoro_i_segnali",
];

/**
 * Avvertenza personale per stile: quale segnale guardare per primo e cosa
 * dirgli. Mostrata SOLO quando quel segnale non è verde — altrimenti è rumore.
 */
const OVERREACH_FOCUS: Record<
  OverreachStyle,
  { signal: ReadinessSignal["name"]; text: string }
> = {
  volume_troppo_in_fretta: {
    signal: "acwr",
    text: "Hai detto che tendi ad alzare il volume troppo in fretta: è esattamente il segnale che si sta muovendo.",
  },
  mai_salto_una_dura: {
    signal: "tsb",
    text: "Hai detto che non salti mai una seduta dura: oggi la fatica accumulata dice che saltarla è la scelta che ti fa progredire.",
  },
  gara_in_allenamento: {
    signal: "ri",
    text: "Hai detto che trasformi gli allenamenti in gare: il recupero non è ancora tornato dall'ultima volta.",
  },
  ignoro_i_segnali: {
    signal: "hrv",
    text: "Hai detto che tendi a ignorare i segnali di malessere: questo è uno di quelli.",
  },
};

/** Segnale già classificato dal calibratore (sostituisce quello fisso). */
export interface CalibratedSignal {
  value: number | null;
  status: SignalStatus;
  detail: string;
  /** Sotto il range normale personale: sostituisce "HRV ↓>10%" nelle regole P1. */
  belowNormal: boolean;
}

export interface RecoveryCalibration {
  /** null → readiness resta sul metodo fisso (storia corta o rada). */
  hrvSignal: CalibratedSignal | null;
  /** Soglie assolute in bpm, non delta: derivano dalla media a 30 giorni. */
  rhrThresholds: { mean: number; amberAbove: number; redAbove: number } | null;
  sleepThresholds: { amberBelow: number; redBelow: number };
  acwrThresholds: { amber: number; red: number };
  /** L'atleta ha dichiarato di non tracciare l'HRV: non usarla, nemmeno vecchia. */
  suppressHrv: boolean;
  /** Marker precoce (collasso del CV): avvisa, non ferma. */
  earlyWarning: string | null;
  focus: { signal: ReadinessSignal["name"]; text: string } | null;
  /**
   * Cosa manca perché le soglie diventino personali ("servono ancora N
   * misure"). È **transitorio**: sparisce da solo quando i dati arrivano, ed
   * è azionabile → va mostrato in dashboard.
   */
  pending: string[];
  /**
   * Soglie personali già attive e da cosa derivano. È **permanente**: si
   * legge una volta e non cambia più → vive nella card in impostazioni, non
   * in dashboard, dove diventerebbe una riga che si smette di vedere.
   */
  applied: string[];
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Mediana: robusta a due notti pessime, che una media si porterebbe dietro. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Deviazione standard campionaria (n−1): stiamo stimando, non censendo. */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function isOverreachStyle(value: unknown): value is OverreachStyle {
  return OVERREACH_STYLES.includes(value as OverreachStyle);
}

/**
 * Legge le risposte da `athlete_profiles.preferences`. Ogni campo non
 * riconosciuto torna null: una preferenza corrotta non deve mai stringere
 * una soglia per sbaglio.
 */
export function recoveryInputsFromPreferences(
  preferences: unknown
): RecoveryInputs {
  if (
    preferences == null ||
    typeof preferences !== "object" ||
    Array.isArray(preferences)
  ) {
    return EMPTY_RECOVERY_INPUTS;
  }
  const raw = (preferences as Record<string, unknown>).recovery;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return EMPTY_RECOVERY_INPUTS;
  }
  const r = raw as Record<string, unknown>;

  const stress = typeof r.stress_vita === "number" ? Math.round(r.stress_vita) : null;

  return {
    traccia_hrv:
      r.traccia_hrv === "mattina" ||
      r.traccia_hrv === "saltuario" ||
      r.traccia_hrv === "no"
        ? r.traccia_hrv
        : null,
    stress_vita:
      stress != null && stress >= 1 && stress <= 5
        ? (stress as 1 | 2 | 3 | 4 | 5)
        : null,
    infortuni_ricorrenti: r.infortuni_ricorrenti === true,
    stile_strafare: isOverreachStyle(r.stile_strafare) ? r.stile_strafare : null,
  };
}

/** Media mobile di ln(HRV) sugli ultimi `window` giorni di calendario. */
function lnWindowMean(
  days: ReadinessInputDay[],
  protocol: HrvProtocol
): { value: number; count: number; lnValues: number[] } | null {
  const lnValues = days
    .map((d) => hrvValue(d, protocol))
    .filter((v): v is number => v != null && v > 0)
    .map((v) => Math.log(v));
  if (lnValues.length === 0) return null;
  return { value: mean(lnValues), count: lnValues.length, lnValues };
}

function formatMs(lnValue: number): string {
  return `${Math.round(Math.exp(lnValue))}ms`;
}

/**
 * Calibra le soglie sulla storia dell'atleta e sulle sue risposte.
 *
 * @param days  wellness in ordine cronologico, ultimo = oggi (la stessa
 *              serie che riceve computeReadiness, tipicamente 30 giorni).
 */
export function computeRecoveryCalibration(
  days: ReadinessInputDay[],
  protocol: HrvProtocol,
  inputs: RecoveryInputs
): RecoveryCalibration {
  const pending: string[] = [];
  const applied: string[] = [];
  const suppressHrv = inputs.traccia_hrv === "no";

  // --- Soglie da sonno, infortuni e stress --------------------------------
  // Prima si calcolano TUTTE, poi si scrivono le note: raccontare una soglia
  // mentre la si calcola significa mostrare un numero che l'aggiustamento
  // successivo cambia, e il numero mostrato deve essere quello usato.

  // Il sonno "tipico" lo dicono le notti misurate, mai una dichiarazione: le
  // ore auto-riferite sono tra le stime peggio calibrate che una persona dia
  // di sé, e chi sovrastima prenderebbe ambra ogni singola notte — il falso
  // allarme che questo modulo esiste per togliere.
  const measuredNights = days
    .map((d) => d.sleepSecs)
    .filter((v): v is number => v != null && v > 0)
    .map((secs) => secs / 3600);
  const typicalSleep =
    measuredNights.length >= MIN_SLEEP_NIGHTS
      ? Math.round(median(measuredNights) * 10) / 10
      : null;

  let sleepAmber = FIXED_SLEEP_AMBER_HOURS;
  let sleepRed = FIXED_SLEEP_RED_HOURS;
  if (typicalSleep != null) {
    // Chi dorme di suo 6h non deve prendere ambra ogni singola notte.
    sleepAmber = Math.max(4.5, typicalSleep - 1);
    sleepRed = Math.max(3.5, typicalSleep - 2);
  }

  // ACWR: resta 1.3/1.5, si stringe solo se ci sono ragioni dichiarate.
  let acwrAmber = FIXED_ACWR_AMBER;
  let acwrRed = FIXED_ACWR_RED;
  if (inputs.infortuni_ricorrenti) {
    acwrAmber = 1.2;
    acwrRed = 1.4;
  }
  // Lo stress extra-sportivo pesa sul recupero quanto il carico
  // d'allenamento (consenso ECSS/ACSM, Meeusen 2013).
  const highStress = inputs.stress_vita != null && inputs.stress_vita >= 4;
  if (highStress) {
    acwrAmber = Math.round((acwrAmber - 0.05) * 100) / 100;
    // La mezz'ora in più ha senso solo sopra una soglia personale: senza una
    // notte tipica nota non c'è nessun "normale" da stringere, e alzare la
    // soglia standard in silenzio sarebbe un aggiustamento che nessuno vede.
    if (typicalSleep != null) sleepAmber += 0.5;
  }

  const tighteningReasons = [
    inputs.infortuni_ricorrenti ? "infortuni ricorrenti" : null,
    highStress ? "stress di vita alto" : null,
  ].filter((r): r is string => r != null);

  if (typicalSleep != null) {
    const perStress = highStress ? ", mezz'ora in più per lo stress" : "";
    applied.push(
      `Soglie sonno ${sleepAmber.toFixed(1)}h / ${sleepRed.toFixed(1)}h dalle tue notti misurate (mediana ${typicalSleep}h)${perStress}.`
    );
  } else if (measuredNights.length > 0) {
    pending.push(
      `Sonno su soglie standard: servono ${MIN_SLEEP_NIGHTS} notti misurate, ne hai ${measuredNights.length}.`
    );
  }
  if (tighteningReasons.length > 0) {
    applied.push(
      `Soglie di carico strette a ${acwrAmber} / ${acwrRed}: hai dichiarato ${tighteningReasons.join(" e ")}.`
    );
  }

  const focus =
    inputs.stile_strafare != null
      ? OVERREACH_FOCUS[inputs.stile_strafare]
      : null;

  const calibration: RecoveryCalibration = {
    hrvSignal: null,
    rhrThresholds: null,
    sleepThresholds: { amberBelow: sleepAmber, redBelow: sleepRed },
    acwrThresholds: { amber: acwrAmber, red: acwrRed },
    suppressHrv,
    earlyWarning: null,
    focus,
    pending,
    applied,
  };

  // --- FC riposo: media personale ±SD invece di +3/+5 bpm fissi -----------
  // Riferimento = tutti i giorni tranne oggi (oggi è il valore da giudicare).
  const rhrBaselineValues = days
    .slice(0, -1)
    .map((d) => d.restingHR)
    .filter((v): v is number => v != null);
  if (rhrBaselineValues.length >= MIN_BASELINE_MEASURES) {
    const m = mean(rhrBaselineValues);
    const sd = stdDev(rhrBaselineValues);
    calibration.rhrThresholds = {
      mean: Math.round(m * 10) / 10,
      // Pavimento in bpm: con una FC riposo molto costante ±1 SD sarebbe
      // meno di un battito e ogni giorno diventerebbe ambra.
      amberAbove: Math.round((m + Math.max(sd, RHR_AMBER_FLOOR_BPM)) * 10) / 10,
      redAbove:
        Math.round((m + Math.max(2 * sd, RHR_RED_FLOOR_BPM)) * 10) / 10,
    };
    applied.push(
      `Soglie FC riposo personali su ${rhrBaselineValues.length} giorni (normale ~${Math.round(m)} bpm).`
    );
  } else {
    // Prima nessuna nota copriva questo caso: chi non ha abbastanza misure di
    // FC a riposo restava sulle soglie fisse in silenzio.
    pending.push(
      `FC riposo su soglie standard: servono ${MIN_BASELINE_MEASURES} giorni di misure, ne hai ${rhrBaselineValues.length}.`
    );
  }

  if (suppressHrv) {
    applied.push("HRV esclusa dal calcolo: hai dichiarato di non tracciarla.");
    return calibration;
  }

  // --- HRV: media mobile 7g di ln(rMSSD) vs range normale personale -------
  const windowDays = days.slice(-HRV_WINDOW_DAYS);
  const baselineDays = days.slice(0, -HRV_WINDOW_DAYS);
  const window = lnWindowMean(windowDays, protocol);
  const baseline = lnWindowMean(baselineDays, protocol);

  if (window == null || window.count < MIN_MEASURES_IN_WINDOW) {
    pending.push(
      `HRV su soglie standard: servono ${MIN_MEASURES_IN_WINDOW} misure negli ultimi ${HRV_WINDOW_DAYS} giorni, ne hai ${window?.count ?? 0}.`
    );
    return calibration;
  }
  if (baseline == null || baseline.count < MIN_BASELINE_MEASURES) {
    pending.push(
      `HRV su soglie standard: servono ${MIN_BASELINE_MEASURES} misure di storico per conoscere il tuo normale, ne hai ${baseline?.count ?? 0}.`
    );
    return calibration;
  }

  const baseMean = baseline.value;
  const baseSd = stdDev(baseline.lnValues);
  if (baseSd <= 0) {
    pending.push("HRV su soglie standard: storico senza variabilità utile.");
    return calibration;
  }

  const normalLow = baseMean - AMBER_SD * baseSd;
  const hardLow = baseMean - RED_SD * baseSd;

  // Persistenza: la stessa media mobile calcolata a ieri. Due giorni sotto il
  // normale non sono più rumore.
  const previousWindow = lnWindowMean(
    days.slice(-HRV_WINDOW_DAYS - 1, -1),
    protocol
  );
  const previousBelowNormal =
    previousWindow != null &&
    previousWindow.count >= MIN_MEASURES_IN_WINDOW &&
    previousWindow.value < normalLow;

  const belowNormal = window.value < normalLow;
  const status: SignalStatus =
    window.value < hardLow
      ? "red"
      : belowNormal && previousBelowNormal
        ? "red"
        : belowNormal
          ? "amber"
          : "green";

  const rangeText = `il tuo normale ${formatMs(normalLow)}–${formatMs(baseMean + baseSd)}`;
  const positionText = belowNormal
    ? `sotto ${rangeText}${previousBelowNormal ? ", 2° giorno" : ""}`
    : `dentro ${rangeText}`;

  calibration.hrvSignal = {
    value: Math.round(Math.exp(window.value) * 10) / 10,
    status,
    detail: `HRV ${HRV_PROTOCOL_LABELS[protocol]} media 7g ${formatMs(window.value)} — ${positionText}`,
    belowNormal,
  };
  applied.push(
    `Soglie HRV personali su ${baseline.count} misure di storico (media mobile 7g, scala logaritmica).`
  );

  // --- Marker precoce: il CV che collassa mentre la media scende ----------
  // Plews 2012: verso il non-functional overreaching la variabilità
  // giorno-per-giorno si appiattisce prima che la media crolli.
  const windowCv = (stdDev(window.lnValues) / window.value) * 100;
  const baselineCv = (baseSd / baseMean) * 100;
  if (
    baselineCv > 0 &&
    windowCv < baselineCv * CV_COLLAPSE_RATIO &&
    window.value < baseMean
  ) {
    calibration.earlyWarning =
      `La variabilità della tua HRV si è appiattita (CV ${windowCv.toFixed(1)}% contro ${baselineCv.toFixed(1)}% abituale) mentre la media scende: ` +
      "è il pattern che precede il sovraccarico. Non è uno stop, ma tienilo d'occhio.";
  }

  return calibration;
}
