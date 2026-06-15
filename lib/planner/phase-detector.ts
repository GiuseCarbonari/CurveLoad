/**
 * Phase detector (Section 11 A "Rolling Phase Logic" + B §1) — funzione PURA.
 *
 * Versione v0 deterministica del modello dual-stream di Section 11: usa le
 * soglie esplicitate dal milestone (ACWR, daysToEvent, slope CTL, RI) con
 * l'ORDINE DI PRIORITÀ di Section 11 (Overreached/Recovery → Taper → Peak →
 * Build → Base). Non chiama API, non legge clock: stessi input → stessa fase.
 *
 * NB: il modello completo di Section 11 (Stream 1 retrospettivo + Stream 2
 * prospettico, hysteresis, reason codes machine-readable) è più ricco; qui ne
 * replichiamo la logica di soglia e l'ordine di priorità. Le soglie sono
 * dichiarate, non tarate su uno storico.
 */

export type Phase = "base" | "build" | "peak" | "taper" | "recovery";

export interface PhaseResult {
  phase: Phase;
  /** Motivo leggibile + auditabile della classificazione. */
  reason: string;
  daysToEvent: number | null;
  /** Slope CTL stimato (punti CTL/settimana sulla finestra fornita). */
  ctl_slope_per_week: number | null;
  /** Reason code machine-readable (compat con Section 11 phase_detection). */
  reason_code: string;
}

/** Soglie ACWR (Gabbett) — dichiarate dal milestone. */
const ACWR_BUILD_LOW = 0.9;
const ACWR_BUILD_HIGH = 1.3;
const ACWR_OVERLOAD = 1.5;
/** Recovery Index sotto cui scatta il recupero (safety, Section 11 A). */
const RI_RECOVERY = 0.6;
/** Finestre calendario (giorni all'evento). */
const TAPER_MAX_DAYS = 14;
const PEAK_MAX_DAYS = 42;

/**
 * Slope CTL in punti/settimana dalla storia 30g (primo vs ultimo valore
 * non-null). null se non ci sono almeno due punti.
 */
export function ctlSlopePerWeek(ctlHistory30d: Array<number | null>): number | null {
  const pts = ctlHistory30d.filter((v): v is number => v != null);
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  // La finestra è ~30 giorni ≈ 4.286 settimane; normalizziamo sul numero di
  // punti disponibili per non gonfiare lo slope quando la storia è corta.
  const weeks = Math.max(1, (pts.length - 1) / 7);
  return Number(((last - first) / weeks).toFixed(2));
}

/**
 * Rileva la macro-fase corrente.
 *
 * @param ctlToday      CTL odierna (letta dal mirror, non ricalcolata).
 * @param ctlHistory30d serie CTL ~30g (per lo slope).
 * @param daysToEvent   giorni all'evento target (null se nessun evento).
 * @param acwr          ACWR corrente (atl/ctl, letto/derivato dal mirror).
 * @param ri            Recovery Index corrente (null se non disponibile).
 */
export function detectPhase(
  ctlToday: number | null,
  ctlHistory30d: Array<number | null>,
  daysToEvent: number | null,
  acwr: number | null,
  ri: number | null = null
): PhaseResult {
  const slope = ctlSlopePerWeek(ctlHistory30d);
  const base = { daysToEvent, ctl_slope_per_week: slope };

  // 1) Recovery / Overreached — safety gate (Section 11 A: priorità massima).
  if (acwr != null && acwr > ACWR_OVERLOAD) {
    return {
      phase: "recovery",
      reason: `ACWR ${acwr.toFixed(2)} > ${ACWR_OVERLOAD}: sovraccarico acuto, fase di recupero forzata.`,
      reason_code: "OVERREACHED_ACWR_HIGH",
      ...base,
    };
  }
  if (ri != null && ri < RI_RECOVERY) {
    return {
      phase: "recovery",
      reason: `Recovery Index ${ri.toFixed(2)} < ${RI_RECOVERY}: recupero insufficiente, fase di recupero.`,
      reason_code: "RECOVERY_RI_LOW",
      ...base,
    };
  }

  // 2) Taper — ancorato alla gara (Section 11 A: richiede evento in calendario).
  if (daysToEvent != null && daysToEvent < TAPER_MAX_DAYS) {
    return {
      phase: "taper",
      reason: `Evento tra ${daysToEvent} giorni (< ${TAPER_MAX_DAYS}): taper pre-gara.`,
      reason_code: "TAPER_RACE_IMMINENT",
      ...base,
    };
  }

  // 3) Peak — gara in avvicinamento, fitness al massimo del ciclo.
  if (daysToEvent != null && daysToEvent <= PEAK_MAX_DAYS) {
    return {
      phase: "peak",
      reason: `Evento tra ${daysToEvent} giorni (${TAPER_MAX_DAYS}–${PEAK_MAX_DAYS}): fase di peak/affilamento.`,
      reason_code: "PEAK_RACE_APPROACHING",
      ...base,
    };
  }

  // 4) Build — ACWR in range di carico e nessun evento ravvicinato.
  if (acwr != null && acwr >= ACWR_BUILD_LOW) {
    const slopeNote =
      slope != null ? ` CTL ${slope >= 0 ? "+" : ""}${slope}/sett.` : "";
    return {
      phase: "build",
      reason: `ACWR ${acwr.toFixed(2)} ≥ ${ACWR_BUILD_LOW}${
        daysToEvent != null ? ` ed evento > ${PEAK_MAX_DAYS} giorni` : " e nessun evento ravvicinato"
      }: fase di build (carico progressivo).${slopeNote}`,
      reason_code: "BUILD_ACWR_LOADING",
      ...base,
    };
  }

  // 5) Base — ACWR basso, CTL stabile o in crescita lenta (default residuale).
  const slopeNote =
    slope != null ? ` CTL ${slope >= 0 ? "+" : ""}${slope}/sett. (stabile/lenta).` : "";
  return {
    phase: "base",
    reason: `ACWR ${acwr != null ? acwr.toFixed(2) : "n/d"} < ${ACWR_BUILD_LOW}: fase di base aerobica.${slopeNote}`,
    reason_code: "BASE_ACWR_STABLE",
    ...base,
  };
}
