import type { AthleteContext } from "@/lib/ai/context";
import type { AthleteProfileData, RPPEntry } from "@/lib/profile/build-profile";

/**
 * Costruzione del prompt "Spiega il mio profilo" — funzioni PURE (testabili
 * a tavolino, nessun I/O). Spec: docs/scheda_atleta_tooltip_e_commento.md §3.
 *
 * Regola ferma (No Virtual Math applicata al testo): l'AI riceve SOLO valori
 * già calcolati e presenti in profile_data — non calcola, non stima, non
 * inventa numeri. findUnexpectedNumbers() è il controllo a valle: segnala
 * (senza bloccare) ogni numero del testo che non deriva dall'input.
 */

const RPP_LABELS: Record<number, string> = {
  5: "5s",
  60: "1min",
  300: "5min",
  1200: "20min",
  3600: "60min",
};

const SYSTEM_PROMPT = `Sei un assistente che spiega a un ciclista amatoriale il suo profilo di potenza, già calcolato da Intervals.icu. Non calcoli e non inventi numeri: usi solo quelli forniti nell'input. Parli italiano semplice, tono incoraggiante e concreto, senza gergo non spiegato. Non prescrivi allenamenti specifici (quello arriva dal planner). Se l'input contiene anche il "contesto" dell'atleta (chi è, obiettivi, condizione recente, decisioni del coach, note già in memoria), usalo per rendere il commento personale e concreto — sempre citando solo numeri presenti nell'input. Se il contesto contiene "filosofia_coaching", quello è il patto già scritto con questo atleta: adotta quel tono e resta coerente con quell'impostazione. Rispondi con esattamente 3 paragrafi brevi, senza titoli né elenchi:
1. Chi sei — il fenotipo in parole povere, cosa sai fare bene.
2. Punti di forza e debolezza — leggendo il Record Power Profile e il confronto con i migliori valori dell'ultimo anno, dove sei forte e dove hai margine, in modo concreto.
3. Su cosa lavorare — la direzione generale di miglioramento, senza sedute specifiche; se conosci obiettivi o gara target dell'atleta, aggancia la direzione a quelli.

Dopo il terzo paragrafo aggiungi UNA riga finale, separata, che inizia esattamente con NOTE_COACH: seguita da un array JSON di 0-2 note che un coach umano si segnerebbe sul taccuino per ricordarle nelle prossime settimane. Ogni nota è {"tipo": "...", "nota": "..."} con tipo scelto tra "preferenza", "infortunio", "traguardo", "osservazione" e nota di massimo 250 caratteri. Annota SOLO cose nuove: non ripetere note già presenti in contesto.memoria né informazioni già scritte nel dossier. Se non c'è nulla di nuovo da annotare scrivi NOTE_COACH: []. Questa riga è per il sistema, non fa parte del commento all'atleta.`;

export interface ProfileExplainPrompt {
  system: string;
  user: string;
  /** Tutti i numeri passati nell'input: base per il check anti-invenzione. */
  allowedNumbers: number[];
}

function rppRow(entry: RPPEntry) {
  return {
    label: RPP_LABELS[entry.duration_s] ?? `${entry.duration_s}s`,
    watts: entry.watts != null ? Math.round(entry.watts) : null,
    wkg: entry.wkg,
    watts_best_1y: entry.watts_1y != null ? Math.round(entry.watts_1y) : null,
  };
}

export function buildProfileExplainPrompt(
  profile: AthleteProfileData,
  context?: AthleteContext
): ProfileExplainPrompt {
  const rpp = profile.rpp
    .filter((e) => e.duration_s in RPP_LABELS)
    .map(rppRow);

  const input = {
    // Fascicolo del context assembler (Passo 4): entra nell'input così
    // collect() qui sotto autorizza automaticamente anche i suoi numeri.
    contesto: context ?? null,
    fenotipo: {
      primary: profile.phenotype.primary,
      secondary: profile.phenotype.secondary,
      confidence: profile.phenotype.confidence,
      apr_ratio: profile.apr?.apr_ratio ?? null,
    },
    cp_wprime: profile.cp_wprime
      ? {
          cp_w: Math.round(profile.cp_wprime.cp_w),
          cp_wkg: profile.cp_wprime.cp_wkg,
          w_prime_kj: profile.cp_wprime.w_prime_kj,
        }
      : null,
    rpp_current: rpp.map(({ label, watts, wkg }) => ({ label, watts, wkg })),
    rpp_best_1y: rpp.map(({ label, watts_best_1y }) => ({ label, watts: watts_best_1y })),
    weight_kg: profile.weight_kg,
    weight_source: profile.weight_source,
  };

  const allowedNumbers: number[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) allowedNumbers.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(input);
  // Le durate dei label ("5s", "20min"...) e la finestra "ultimi 14 giorni"
  // del contesto compariranno nel testo come numeri.
  allowedNumbers.push(1, 5, 14, 20, 60);

  return {
    system: SYSTEM_PROMPT,
    user: `Ecco il profilo dell'atleta (valori già calcolati, gli unici che puoi citare):\n${JSON.stringify(input, null, 2)}`,
    allowedNumbers,
  };
}

/**
 * Estrae i numeri dal testo generato e restituisce quelli NON riconducibili
 * all'input (arrotondamento a intero / 1 / 2 decimali di un valore ammesso).
 * ponytail: euristica naif e log-only — è prosa, non una decisione di
 * allenamento; se in beta produce troppi falsi positivi, raffinare qui.
 */
export function findUnexpectedNumbers(
  text: string,
  allowedNumbers: number[]
): string[] {
  const allowed = new Set<string>();
  for (const n of allowedNumbers) {
    allowed.add(String(Math.round(n)));
    allowed.add(n.toFixed(1));
    allowed.add(n.toFixed(2));
    // Percentuali di variazione plausibili non sono derivabili: non le
    // autorizziamo — se l'AI le calcola, DEVE risultare segnalato.
  }
  // Piccoli interi (0-10): ordinali/quantità discorsive, non metriche.
  for (let i = 0; i <= 10; i++) allowed.add(String(i));

  const found = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const unexpected: string[] = [];
  for (const raw of found) {
    const normalized = raw.replace(",", ".");
    const canonical = normalized.includes(".")
      ? String(Number(normalized))
      : normalized;
    if (!allowed.has(canonical) && !allowed.has(normalized) && !unexpected.includes(raw)) {
      unexpected.push(raw);
    }
  }
  return unexpected;
}
