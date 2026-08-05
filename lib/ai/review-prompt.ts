import type { AthleteContext } from "@/lib/ai/context";
import type { ActualWeekSummary } from "@/lib/review/week-actual";
import type { SessionExecution } from "@/lib/review/execution";
import type { Divergence, FeelAnswers } from "@/lib/review/feel";
import type { ReviewTrend } from "@/lib/review/trends";
import type { WeekWindow } from "@/lib/review/week-window";

/**
 * Costruzione del prompt della review settimanale — funzione PURA, stesso
 * spartito di lib/ai/philosophy-prompt.ts. Le divergenze sensazioni↔dati
 * (lib/review/feel.ts) e le tendenze (lib/review/trends.ts) arrivano GIÀ
 * calcolate: stessa lezione del Passo 12 (vedi memoria di progetto
 * "verificare-prompt-ai-con-chiamata-reale") — un modello non fa scontrare
 * due fonti se non gli passi il disaccordo già trovato.
 *
 * No Virtual Math: l'AI riceve solo numeri già calcolati dal motore
 * (execution, drift, trend) — non calcola, non stima, non inventa.
 */

const SYSTEM_PROMPT = `Sei il coach di un atleta amatoriale e stai scrivendo la sua review della settimana appena chiusa. Parli italiano semplice e diretto, in seconda persona ("tu"). Non calcoli e non inventi numeri: usi solo quelli presenti nell'input — ogni percentuale, ogni bpm, ogni minuto è già stato calcolato dal motore. I valori in "sensazioni" sono su scala 1-5: leggi ESATTAMENTE "sensazioni.legenda" per sapere cosa significa ogni numero per ogni campo (per alcuni campi un numero basso è positivo, per altri è negativo) — non dedurre il significato dal valore, non citare un campo delle sensazioni come "bandiera" se la legenda dice che quel valore è nella norma o positivo. Se l'input contiene "contesto.filosofia_coaching", quello è il patto già scritto con questo atleta: adotta quel tono e resta coerente con quell'impostazione.

Se vuoi dire quanto della settimana è stato completato, usa SOLO i conteggi già presenti in "sedute" (es. "3 sedute su 6"): non dividere né calcolare MAI una percentuale nuova — se non è già un numero nell'input, non esiste.

Regola sulle attività Strava: "dati_mancanti_strava" elenca le date (già identificate dal motore, non da te) in cui c'è un'attività ma Intervals.icu non ne fornisce i dati perché arriva da Strava — non sono sedute saltate. Se devi parlare di una di QUELLE date esatte, usa la frase già scritta lì. Per OGNI ALTRA data che risulta "saltata" in "esecuzione", NON menzionare Strava: è una seduta genuinamente senza alcuna attività registrata.

Rispondi con questi blocchi, in ordine, senza titoli numerati né elenchi puntati (paragrafi brevi, uno per blocco):
1. Pianificato vs reale — cosa prevedeva la settimana (fase, sedute dure, eventuale scarico) e cosa è successo davvero, in breve.
2. Come è andata l'esecuzione — qualità, non solo presenza: le sedute dure sono andate come previsto? Le uscite facili erano davvero facili o hanno sconfinato? Se una seduta lunga o dura mostra decoupling, dillo e spiega cosa significa. Se "sensazioni.sedute_peggiori" è compilato, cita cosa dice l'atleta su quella seduta specifica.
3. Sensazioni vs dati — se l'input contiene "divergenze" non vuoto, usale ESPLICITAMENTE: dì dove le sensazioni dell'atleta e i numeri non coincidono, e cosa può significare. Questo blocco è il più importante: non limitarti a elencare le sensazioni, confrontale con i dati riga per riga. Se "divergenze" è vuoto, dillo in una riga sola invece di inventare un confronto.
4. Bandiere che contano — solo segnali reali dall'input (carico, sedute dure saltate, dolori riferiti); se non ce ne sono, ometti il blocco.
5. Cosa è andato bene — se "sensazioni.sedute_migliori" è compilato, questo blocco parte da lì e cita cosa dice l'atleta. Se la data che l'atleta descrive è in "dati_mancanti_strava", usa quella frase. Se non lo è e non trovi comunque una voce "eseguita" corrispondente in "esecuzione" per quella data, di' semplicemente che quella seduta non risulta nei dati sincronizzati (senza menzionare Strava). Non contraddire mai "sedute_migliori"/"sedute_peggiori": sono l'esperienza diretta dell'atleta, non un'opinione da correggere. Se "sensazioni.sedute_migliori" è vuoto, sii specifico su una seduta o un numero preciso dall'esecuzione.
6. Una o due modifiche concrete per la prossima settimana, ciascuna con il suo perché. Non prescrivere sedute specifiche con struttura (le sceglie il planner): parla di direzione (volume, spaziatura delle dure, recupero).

Dopo l'ultimo blocco aggiungi UNA riga finale, separata, che inizia esattamente con NOTE_COACH: seguita da un array JSON di 0-2 note che un coach umano si segnerebbe sul taccuino per ricordarle nelle prossime settimane. Ogni nota è {"tipo": "...", "nota": "..."} con tipo scelto tra "preferenza", "infortunio", "traguardo", "osservazione" e nota di massimo 250 caratteri. Annota SOLO cose nuove: non ripetere note già in contesto.memoria né informazioni già nel dossier. Se non c'è nulla di nuovo scrivi NOTE_COACH: []. Questa riga è per il sistema, non fa parte della review.`;

export interface ReviewPromptInput {
  week: WeekWindow;
  plan: {
    phase: string | null;
    hardPlanned: number;
    isDeload: boolean;
    phaseReason: string | null;
    mesocycleReason: string | null;
  } | null;
  actual: ActualWeekSummary;
  execution: SessionExecution[];
  feel: FeelAnswers;
  divergences: Divergence[];
  trends: ReviewTrend[];
  efficiencyTrend: { interpretation: string; summary: string } | null;
  context: AthleteContext | null;
}

export interface ReviewPrompt {
  system: string;
  user: string;
  /** Tutti i numeri passati nell'input: base per il check anti-invenzione. */
  allowedNumbers: number[];
}

const FEEL_LEGEND =
  "Scala 1-5. energia: 1=molto bassa, 5=molto alta. sonno: 1=molto scarso, 5=ottimo. dolori: 1=nessuno, 5=molto forte (basso=positivo). stress: 1=nessuno, 5=molto alto (basso=positivo). motivazione: 1=molto bassa, 5=molto alta.";

function feelForPrompt(feel: FeelAnswers) {
  return { ...feel, legenda: FEEL_LEGEND };
}

function executionForPrompt(e: SessionExecution) {
  return {
    data: e.date,
    stato: e.status,
    dura: e.planned?.is_hard ?? null,
    titolo: e.planned?.title ?? null,
    obiettivo: e.planned?.session_objective ?? null,
    completamento_pct: e.completion?.percent ?? null,
  };
}

/**
 * Frasi già pronte, una per data, per le attività con fonte Strava senza
 * dati (Intervals non le fornisce — vedi docs/INTERVALS_API_NOTES.md). Il
 * modello le usa così come sono, SOLO per quella data esatta: stessa
 * strategia delle divergenze, non lasciare al modello l'abbinamento data↔causa.
 */
function stravaCaveats(execution: SessionExecution[]): string[] {
  return execution
    .filter((e) => e.dataUnavailable === "strava")
    .map(
      (e) =>
        `${e.date}: quel giorno risulta un'attività ma Intervals non ne fornisce i dati perché arriva da Strava.`
    );
}

/** Conteggi pronti da citare così com'è ("3 su 6"), mai da ricalcolare in una percentuale nuova. */
function executionCounts(execution: SessionExecution[]) {
  return {
    pianificate: execution.filter((e) => e.planned != null).length,
    eseguite: execution.filter((e) => e.status === "eseguita").length,
    parziali: execution.filter((e) => e.status === "parziale").length,
    saltate: execution.filter((e) => e.status === "saltata").length,
    extra: execution.filter((e) => e.status === "extra").length,
  };
}

export function buildReviewPrompt(input: ReviewPromptInput): ReviewPrompt {
  const promptInput = {
    contesto: input.context ?? null,
    settimana: { dal: input.week.weekStart, al: input.week.weekEnd },
    piano: input.plan,
    reale: input.actual,
    sedute: executionCounts(input.execution),
    esecuzione: input.execution.map(executionForPrompt),
    dati_mancanti_strava: stravaCaveats(input.execution),
    sensazioni: feelForPrompt(input.feel),
    divergenze: input.divergences.map((d) => d.text),
    tendenze: input.trends.map((t) => t.text),
    tendenza_efficienza: input.efficiencyTrend,
  };

  const allowedNumbers: number[] = [];
  const NUM_RE = /\d+(?:[.,]\d+)?/g;
  const collect = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      allowedNumbers.push(value);
    } else if (typeof value === "string") {
      for (const m of value.match(NUM_RE) ?? []) {
        const n = Number(m.replace(",", "."));
        if (Number.isFinite(n)) allowedNumbers.push(n);
      }
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(collect);
    }
  };
  collect(promptInput);
  // Numeri discorsivi: i blocchi (1-6), 1-2 modifiche/note finali.
  allowedNumbers.push(1, 2, 3, 4, 5, 6);

  return {
    system: SYSTEM_PROMPT,
    user: `Ecco la settimana appena chiusa (valori già calcolati, gli unici che puoi citare):\n${JSON.stringify(promptInput, null, 2)}`,
    allowedNumbers,
  };
}
