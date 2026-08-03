import type { AthleteContext } from "@/lib/ai/context";
import type { ReadinessResult } from "@/lib/readiness";

/**
 * Costruzione del prompt "Spiega la mia giornata" (readiness di oggi) —
 * funzione PURA, stesso spartito di lib/ai/profile-explain-prompt.ts:
 * l'AI riceve solo la decisione e i segnali già calcolati dal motore
 * readiness (lib/readiness.ts), non calcola e non inventa numeri.
 */

const SIGNAL_LABEL: Record<ReadinessResult["signals"][number]["name"], string> = {
  hrv: "HRV",
  rhr: "FC a riposo",
  sleep: "Sonno",
  tsb: "Freschezza (TSB)",
  acwr: "Equilibrio carico (ACWR)",
  ri: "Indice di recupero",
};

const SYSTEM_PROMPT = `Sei un assistente che spiega a un atleta amatoriale la sua prontezza di oggi (readiness), già calcolata da un motore deterministico — non tu. Non calcoli e non inventi numeri: usi solo quelli forniti nell'input. Parli italiano semplice, tono onesto e incoraggiante, senza gergo non spiegato. La decisione (via libera / attenzione / riposo) è già presa dal motore: tu la spieghi, non la cambi né la rimetti in discussione. Non prescrivi una seduta specifica (ci pensa il planner). Se l'input contiene il "contesto" dell'atleta (chi è, obiettivi, decisioni recenti, note in memoria), usalo per personalizzare, sempre citando solo numeri presenti nell'input. Se il contesto contiene "filosofia_coaching", quello è il patto già scritto con questo atleta: adotta quel tono e resta coerente con quell'impostazione. Rispondi con UN SOLO paragrafo breve (3-5 frasi), senza titoli né elenchi: perché la giornata è quella che è, cosa tenere d'occhio, un consiglio pratico e generico su come affrontarla.`;

export interface OggiExplainPrompt {
  system: string;
  user: string;
  /** Tutti i numeri passati nell'input: base per il check anti-invenzione. */
  allowedNumbers: number[];
}

export function buildOggiExplainPrompt(
  readiness: ReadinessResult,
  context?: AthleteContext
): OggiExplainPrompt {
  const input = {
    contesto: context ?? null,
    prontezza: {
      decisione: readiness.decision,
      confidenza: readiness.confidence,
      motivi: readiness.reasons,
      segnali: readiness.signals.map((s) => ({
        nome: SIGNAL_LABEL[s.name] ?? s.name,
        valore: s.value,
        stato: s.status,
        dettaglio: s.detail,
      })),
    },
  };

  // I segnali portano prosa già scritta dal motore (es. "HRV ↓12% vs
  // baseline 7g"): i numeri lì dentro sono legittimi quanto quelli nei campi
  // strutturati, quindi la raccolta include anche le stringhe (a differenza
  // di profile-explain-prompt.ts, che non ne aveva bisogno).
  const allowedNumbers: number[] = [];
  const NUM_RE = /\d+(?:[.,]\d+)?/g;
  const collect = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      allowedNumbers.push(value);
    } else if (typeof value === "string") {
      for (const m of value.match(NUM_RE) ?? []) {
        allowedNumbers.push(Number(m.replace(",", ".")));
      }
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(collect);
    }
  };
  collect(input);

  return {
    system: SYSTEM_PROMPT,
    user: `Ecco la prontezza di oggi (valori già calcolati, gli unici che puoi citare):\n${JSON.stringify(input, null, 2)}`,
    allowedNumbers,
  };
}
