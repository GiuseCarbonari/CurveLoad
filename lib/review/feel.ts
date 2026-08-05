/**
 * Confronto sensazioni ↔ dati — regole DETERMINISTICHE, non lasciate al
 * modello. Lezione del Passo 12 (filosofia di coaching, vedi memoria di
 * progetto "verificare-prompt-ai-con-chiamata-reale"): un modello non fa
 * scontrare due fonti se non gli passi il disaccordo già trovato. Qui il
 * disaccordo lo trova il codice; il modello lo mette in parole.
 *
 * Scale delle risposte: 1-5. energia/sonno/motivazione: 1=molto basso,
 * 5=molto alto. dolori/stress: 1=nessuno, 5=molto alto (più alto = peggio).
 */

export interface FeelAnswers {
  energia: 1 | 2 | 3 | 4 | 5;
  sonno: 1 | 2 | 3 | 4 | 5;
  dolori: 1 | 2 | 3 | 4 | 5;
  stress: 1 | 2 | 3 | 4 | 5;
  motivazione: 1 | 2 | 3 | 4 | 5;
  sedute_migliori: string | null;
  sedute_peggiori: string | null;
  note: string | null;
}

export interface FeelReconciliationInput {
  acwr: number | null;
  tsb: number | null;
  hardSessionsPlanned: number;
  hardSessionsMissed: number;
  /** Media della frazione di tempo sopra la soglia facile sulle uscite previste facili. */
  avgEasyAboveCeilingFraction: number | null;
  /** Decoupling più alto fra le uscite con abbastanza campioni (tipicamente la lunga). */
  maxDecouplingPct: number | null;
  /** Media ore di sonno REALI della settimana, da Intervals (se disponibile). */
  sleepAvgHoursFromIntervals: number | null;
}

export interface Divergence {
  code: string;
  text: string;
}

const EASY_CEILING_ALERT_FRACTION = 0.3; // 30%+ del tempo sopra soglia = "non era facile"
const DECOUPLING_ALERT_PCT = 5; // soglia classica di attenzione

export function reconcileFeelVsData(
  feel: FeelAnswers,
  data: FeelReconciliationInput
): Divergence[] {
  const out: Divergence[] = [];

  if (feel.energia >= 4 && data.acwr != null && data.acwr >= 1.3) {
    out.push({
      code: "energia_alta_acwr_alto",
      text: `Energia percepita alta, ma ACWR ${data.acwr.toFixed(2)} indica un carico acuto sopra la soglia di attenzione (≥1.3).`,
    });
  }

  if (
    feel.energia <= 2 &&
    data.acwr != null &&
    data.acwr < 1.0 &&
    data.tsb != null &&
    data.tsb >= -10
  ) {
    out.push({
      code: "energia_bassa_carico_normale",
      text: `Energia percepita bassa, ma ACWR ${data.acwr.toFixed(2)} e TSB ${data.tsb.toFixed(1)} non indicano sovraccarico da allenamento: vale la pena guardare fattori fuori allenamento (sonno, stress, vita).`,
    });
  }

  if (
    data.avgEasyAboveCeilingFraction != null &&
    data.avgEasyAboveCeilingFraction > EASY_CEILING_ALERT_FRACTION
  ) {
    const pct = Math.round(data.avgEasyAboveCeilingFraction * 100);
    out.push({
      code: "facili_non_facili",
      text: `Le uscite previste facili hanno passato in media il ${pct}% del tempo sopra la soglia aerobica: probabilmente non erano davvero facili, indipendentemente da come sono state percepite.`,
    });
  }

  if (data.maxDecouplingPct != null && data.maxDecouplingPct > DECOUPLING_ALERT_PCT) {
    out.push({
      code: "decoupling_alto",
      text: `Nella seduta più significativa il rapporto sforzo/battito è peggiorato del ${data.maxDecouplingPct.toFixed(1)}% dalla prima alla seconda metà: segnale di affaticamento a fine seduta.`,
    });
  }

  if (feel.sonno <= 2 && data.sleepAvgHoursFromIntervals != null) {
    out.push({
      code: "sonno_percepito_basso_confermato",
      text: `Sonno percepito scarso, coerente con la media reale di ${data.sleepAvgHoursFromIntervals.toFixed(1)}h registrata su Intervals questa settimana.`,
    });
  }

  if (feel.sonno >= 4 && data.sleepAvgHoursFromIntervals != null && data.sleepAvgHoursFromIntervals < 6) {
    out.push({
      code: "sonno_percepito_alto_smentito",
      text: `Sonno percepito buono, ma la media reale registrata su Intervals è di sole ${data.sleepAvgHoursFromIntervals.toFixed(1)}h: la qualità percepita non riflette la quantità.`,
    });
  }

  if (data.hardSessionsPlanned > 0 && data.hardSessionsMissed > 0) {
    out.push({
      code: "dure_saltate",
      text: `${data.hardSessionsMissed} seduta/e dura/e su ${data.hardSessionsPlanned} pianificate non eseguita/e o solo parziale/i.`,
    });
  }

  return out;
}
