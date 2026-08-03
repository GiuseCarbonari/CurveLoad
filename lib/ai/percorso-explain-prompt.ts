import type { AthleteContext } from "@/lib/ai/context";
import type { GapAnalysisResult } from "@/lib/terrain/gap-analysis";
import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import type { RaceEstimateV2 } from "@/lib/terrain/race-estimator-v2";

/**
 * Costruzione del prompt "Spiega il percorso" — funzione PURA, stesso
 * spartito di lib/ai/profile-explain-prompt.ts. L'AI riceve solo la
 * geometria del percorso, i limitatori e (se presente) la stima tempi già
 * calcolati deterministicamente (gap-analysis.ts, race-estimator-v2.ts): non
 * calcola e non inventa numeri. Copre altimetria, limitatori, pacing e — in
 * prosa generica, senza quantità inventate — alimentazione e recupero.
 */

export interface PercorsoEvent {
  id: number | string | null;
  name: string | null;
  start_date_local: string | null;
  distance_km: number | null;
}

const SYSTEM_PROMPT = `Sei un assistente che spiega a un ciclista amatoriale il percorso della sua prossima gara, partendo da un'analisi già calcolata da un motore deterministico — non tu. Non calcoli e non inventi numeri: usi solo quelli forniti nell'input. Parli italiano semplice, tono concreto e incoraggiante. Copri in prosa, senza titoli né elenchi, in 2 paragrafi brevi:
1. Il percorso e i suoi punti chiave — che tipo di gara è, dove sono le salite più dure e perché (leggendo i limitatori), collegandoli agli obiettivi dell'atleta se presenti nel contesto.
2. Come affrontarla — pacing generale (partenza, parte centrale, finale, se la stima tempi è presente), un consiglio generico su alimentazione/idratazione e recupero coerente con la durata stimata, SENZA inventare quantità precise (grammi, calorie, litri) che non sono nell'input.
Se l'input contiene il "contesto" dell'atleta (obiettivi, decisioni recenti, note in memoria), usalo per personalizzare. Se il contesto contiene "filosofia_coaching", quello è il patto già scritto con questo atleta: adotta quel tono e resta coerente con quell'impostazione.`;

export interface PercorsoExplainPrompt {
  system: string;
  user: string;
  /** Tutti i numeri passati nell'input: base per il check anti-invenzione. */
  allowedNumbers: number[];
}

export function buildPercorsoExplainPrompt(
  terrain: TerrainSummary,
  analysis: GapAnalysisResult,
  event: PercorsoEvent,
  raceEstimate: RaceEstimateV2 | null,
  context?: AthleteContext
): PercorsoExplainPrompt {
  const input = {
    contesto: context ?? null,
    evento: {
      nome: event.name,
      distanza_km: event.distance_km ?? terrain.total_distance_km,
      dislivello_m: terrain.total_elevation_m,
      m_per_km: terrain.elevation_per_km,
      tipo_percorso: terrain.course_character,
    },
    salite: terrain.climbs.map((c) => ({
      km: c.position_km,
      lunghezza_km: c.distance_km,
      dislivello_m: c.elevation_m,
      pendenza_media_pct: c.avg_gradient_pct,
      pendenza_max_pct: c.max_gradient_pct,
      categoria: c.category,
    })),
    limitatori: analysis.limiters.map((l) => ({
      nome: l.name,
      severita: l.severity,
      salite_riferimento: l.climb_refs,
      richiesto_wkg: l.required_wkg,
      atleta_wkg: l.athlete_wkg,
      gap_wkg: l.gap_wkg,
      fatica: l.fatigue_level,
    })),
    nota_analisi: analysis.note,
    stima_tempi: raceEstimate
      ? {
          arrivo_stimato: raceEstimate.pacing.finish_realistic,
          intervallo: raceEstimate.pacing.finish_range,
          avviso: raceEstimate.pacing.warning,
          pacing_per_tratto: raceEstimate.pacing.pacing_advice.map((p) => ({
            tratto: p.label,
            da_km: p.from_km,
            a_km: p.to_km,
            obiettivo_wkg: p.target_wkg,
            velocita_media_kmh: p.avg_speed_kmh,
          })),
        }
      : null,
  };

  // Come in oggi-explain-prompt.ts: alcuni campi sono prosa già scritta dal
  // motore (es. "arrivo_stimato": "3h 45min") con numeri legittimi al loro
  // interno, quindi la raccolta include anche le stringhe.
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
    user: `Ecco l'analisi del percorso (valori già calcolati, gli unici che puoi citare):\n${JSON.stringify(input, null, 2)}`,
    allowedNumbers,
  };
}
