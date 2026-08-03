import type { AthleteContext } from "@/lib/ai/context";
import {
  resolveSchools,
  suggestSchools,
  traitsFromAnswers,
  type CoachingSchool,
} from "@/lib/coaching/schools";
import type { FilosofiaForm } from "@/lib/onboarding/dossier";

/**
 * Costruzione del prompt «Scrivi la mia filosofia» — funzioni PURE, nessun I/O.
 * Stesso spartito di lib/ai/profile-explain-prompt.ts.
 *
 * Le scuole NON le sceglie il modello: o le ha scelte l'atleta nell'intervista,
 * o le sceglie il codice (suggestSchools, deterministico). Il modello riceve la
 * metodologia già scritta e verificata di docs/COACHING_SCHOOLS.md e può solo
 * usarla — non può inventarsi un allenatore né attribuirgli un metodo, perché
 * Groq non naviga e quello che "ricorda" non è verificabile.
 *
 * Vale anche qui la regola No Virtual Math: i numeri citabili sono solo quelli
 * dell'input (contesto dell'atleta), e findUnexpectedNumbers li controlla a valle.
 */

const SYSTEM_PROMPT = `Sei il coach di un ciclista/podista amatoriale e stai scrivendo, per lui, la filosofia di allenamento che userai da qui in avanti. Parli italiano semplice e diretto, in seconda persona ("tu"). Non calcoli e non inventi numeri: usi solo quelli presenti nell'input. Non citare allenatori o studi che non siano nella sezione "scuole" dell'input: quelle sono le uniche fonti verificate che hai.

Rispondi con esattamente 4 paragrafi brevi, senza titoli né elenchi:
1. Chi sei come atleta — quello che dicono i tuoi dati reali, e dove confermano o smentiscono quello che hai dichiarato tu. Se qualcosa non torna, dillo con garbo ma dillo.
2. Da chi prendo — le scuole scelte e PERCHÉ proprio quelle per te, collegandole alle tue risposte e ai tuoi dati. Se due scuole si contraddicono su un punto, di' quale delle due segui nel tuo caso e perché.
3. Come ti alleno — la direzione concreta: che tipo di lavoro sarà la spina dorsale delle tue settimane, come tratto il recupero, cosa NON farò con te. Niente sedute specifiche con numeri: quelle le costruisce il planner.
4. Come ti parlo — il tono che userò e cosa farò quando le cose vanno male, coerente col tono che hai chiesto.

Non è un piano di allenamento e non è una scheda: è il patto tra te e il tuo atleta. Massimo 400 parole in totale.`;

export interface PhilosophyPrompt {
  system: string;
  user: string;
  /** Tutti i numeri passati nell'input: base per il check anti-invenzione. */
  allowedNumbers: number[];
  /** Scuole effettivamente passate al modello (scelte o suggerite). */
  schools: CoachingSchool[];
  /** true se le ha suggerite il codice perché l'atleta non ne conosceva. */
  suggested: boolean;
}

/** Vista compatta della scuola per il prompt: niente tratti interni. */
function schoolForPrompt(s: CoachingSchool) {
  return { nome: s.nome, metodo: s.metodo, fonti: s.fonti };
}

export function buildPhilosophyPrompt(
  risposte: FilosofiaForm | null,
  stile: string | null,
  context: AthleteContext | null
): PhilosophyPrompt {
  const scelte = risposte ? resolveSchools(risposte.scuole) : [];
  const suggested = scelte.length === 0;
  const schools = suggested
    ? suggestSchools(stile, risposte ? traitsFromAnswers(risposte) : [])
    : scelte;

  const input = {
    contesto: context,
    intervista: risposte
      ? {
          storia: risposte.storia || null,
          blocchi_duri: risposte.blocchi_duri || null,
          struttura_o_flessibilita: risposte.struttura || null,
          dati_o_sensazioni: risposte.dati_sensazioni || null,
          tono_richiesto: risposte.tono || null,
          gli_piace: risposte.piace,
          detesta: risposte.detesta,
        }
      : null,
    stile_allenamento: stile,
    scuole: schools.map(schoolForPrompt),
    scuole_scelte_dall_atleta: !suggested,
  };

  const allowedNumbers: number[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) allowedNumbers.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
    else if (typeof value === "string") {
      // Come in oggi/percorso-explain-prompt: l'input contiene prosa già
      // scritta (il metodo delle scuole: "80/20", "4×8", "84-97% dell'FTP").
      // Quei numeri sono verificati in docs/COACHING_SCHOOLS.md, quindi
      // citarli non è inventare.
      for (const m of value.match(/\d+(?:[.,]\d+)?/g) ?? []) {
        const n = Number(m.replace(",", "."));
        if (Number.isFinite(n)) allowedNumbers.push(n);
      }
    }
  };
  collect(input);
  // Numeri discorsivi: i 4 paragrafi, la finestra "ultimi 14 giorni" del contesto.
  allowedNumbers.push(1, 2, 3, 4, 14);

  return {
    system: SYSTEM_PROMPT,
    user: `Ecco tutto quello che sai su questo atleta (gli unici numeri e le uniche scuole che puoi citare):\n${JSON.stringify(input, null, 2)}`,
    allowedNumbers,
    schools,
    suggested,
  };
}
