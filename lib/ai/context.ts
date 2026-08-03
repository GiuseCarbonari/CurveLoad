import type { MirrorData } from "@/lib/intervals/sync";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Context assembler (PIANO.md Passo 4) — il "fascicolo" che ogni chiamata AI
 * riceve insieme alla domanda specifica: chi è l'atleta (dossier), come sta
 * (ultimo mirror Intervals), cosa il coach gli ha già detto (decisioni
 * recenti) e cosa si è annotato sul taccuino (athlete_memory, Passo 5).
 *
 * Stesso spartito del resto del layer AI: condensazione PURA (testabile a
 * tavolino) + un orchestratore I/O sottile. Regola No Virtual Math: qui non
 * si calcola nessuna metrica — si copiano valori già presenti nel DB, al più
 * arrotondati per presentazione (come già fa profile-explain-prompt.ts).
 */

/** Colonne dossier lette da athlete_profiles (migration 006/014). */
export interface DossierRow {
  nome: string | null;
  eta: number | null;
  sesso: string | null;
  sport_principali: string[] | null;
  livello_esperienza: string | null;
  obiettivi: string | null;
  gare_target: unknown;
  data_obiettivo: string | null;
  disponibilita_ore_sett: number | null;
  giorni_preferiti: string[] | null;
  giorni_impossibili: string[] | null;
  infortuni_attuali: string | null;
  dolore_attuale: string | null;
  limiti_principali: string | null;
  preferenze_allenamento: string | null;
  stile_allenamento: string | null;
  note_personali: string | null;
  /**
   * Risposte dell'intervista filosofia (migration 023): condenseContext ne
   * estrae solo piace/detesta (vedi sotto) — dal wizard senza più lo step
   * "Parametri fisiologici" è l'unica fonte di preferenze di seduta per i
   * nuovi utenti; preferenze_allenamento resta per chi l'aveva già scritta.
   */
  filosofia_risposte: { piace?: string[]; detesta?: string[] } | null;
  /** Filosofia di coaching generata (migration 023): dà la voce al coach. */
  filosofia_coaching: string | null;
}

/** Riga condensata di coach_decisions. */
export interface DecisionRow {
  date: string;
  decision_type: string;
  recommendation: string;
}

/** Riga condensata di athlete_memory (taccuino del coach, migration 021). */
export interface MemoryRow {
  created_at: string;
  memory_type: string;
  nota: string;
}

export interface ContextSources {
  dossier: DossierRow | null;
  mirror: MirrorData | null;
  dataQualityLevel: number | null;
  decisions: DecisionRow[];
  memories: MemoryRow[];
}

export interface AthleteContext {
  /** Dossier ripulito dai campi vuoti; null se l'atleta non l'ha compilato. */
  atleta: Record<string, unknown> | null;
  /** Condizione dall'ultimo mirror Intervals; null se mai sincronizzato. */
  condizione: {
    aggiornata_al: string;
    prontezza_oggi: {
      decisione: MirrorData["readiness_today"]["decision"];
      motivi: string[];
      fiducia: MirrorData["readiness_today"]["confidence"];
    };
    forma: { ctl: number | null; atl: number | null };
    ftp_w: number | null;
    peso_kg: number | null;
    qualita_dati_0_4: number | null;
    attivita_ultimi_14g: Array<{
      data: string;
      nome: string | null;
      tipo: string | null;
      durata_min: number | null;
      carico: number | null;
      rpe: number | null;
    }>;
  } | null;
  decisioni_recenti: Array<{ data: string; tipo: string; decisione: string }>;
  /** Note del taccuino del coach, dalla più recente. */
  memoria: Array<{ data: string; tipo: string; nota: string }>;
}

const MAX_ACTIVITIES = 20;
const MAX_DECISIONS = 10;
const MAX_MEMORIES = 20;

/** Rimuove null/undefined, stringhe vuote e array vuoti (prompt più compatto). */
function prune(obj: Record<string, unknown>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Condensazione pura: dalle righe DB al fascicolo per il prompt. */
export function condenseContext(sources: ContextSources): AthleteContext {
  const filosofia = sources.dossier?.filosofia_risposte ?? null;
  const atleta = sources.dossier
    ? prune({
        ...sources.dossier,
        filosofia_risposte: undefined, // il blob grezzo non serve al prompt
        piace_allenamento: filosofia?.piace ?? null,
        evita_allenamento: filosofia?.detesta ?? null,
      })
    : null;

  let condizione: AthleteContext["condizione"] = null;
  const mirror = sources.mirror;
  if (mirror) {
    // Finestra "ultimi 14 giorni" misurata dal fetched_at del mirror stesso:
    // deterministico e coerente anche rileggendo uno snapshot vecchio.
    const cutoff = new Date(mirror.fetched_at);
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const attivita = [...mirror.activities_90d]
      .filter((a) => a.start_date_local.slice(0, 10) >= cutoffIso)
      .sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))
      .slice(0, MAX_ACTIVITIES)
      .map((a) => ({
        data: a.start_date_local.slice(0, 10),
        nome: a.name,
        tipo: a.sport_type ?? a.type,
        durata_min:
          a.moving_time != null ? Math.round(a.moving_time / 60) : null,
        carico: a.icu_training_load,
        rpe: a.perceived_exertion,
      }));

    const latestWellness = mirror.wellness_30d.at(-1) ?? null;
    condizione = {
      aggiornata_al: mirror.fetched_at.slice(0, 10),
      prontezza_oggi: {
        decisione: mirror.readiness_today.decision,
        motivi: mirror.readiness_today.reasons,
        fiducia: mirror.readiness_today.confidence,
      },
      forma: {
        ctl: latestWellness?.ctl ?? null,
        atl: latestWellness?.atl ?? null,
      },
      ftp_w: mirror.athlete_profile.ftp,
      peso_kg: mirror.athlete_profile.weight,
      qualita_dati_0_4: sources.dataQualityLevel,
      attivita_ultimi_14g: attivita,
    };
  }

  const decisioni_recenti = sources.decisions
    .slice(0, MAX_DECISIONS)
    .map((d) => ({
      data: d.date,
      tipo: d.decision_type,
      decisione: d.recommendation,
    }));

  const memoria = sources.memories.slice(0, MAX_MEMORIES).map((m) => ({
    data: m.created_at.slice(0, 10),
    tipo: m.memory_type,
    nota: m.nota,
  }));

  return { atleta, condizione, decisioni_recenti, memoria };
}

/**
 * Orchestratore I/O: legge le quattro fonti e restituisce il fascicolo condensato.
 * Ogni fonte mancante degrada a null/[] — il chiamante decide se è un problema
 * (per la prosa non lo è: si personalizza con quello che c'è).
 */
export async function assembleAthleteContext(
  userId: string
): Promise<AthleteContext> {
  const admin = createAdminClient();

  const [dossierRes, snapshotRes, decisionsRes, memoriesRes] = await Promise.all([
    admin
      .from("athlete_profiles")
      .select(
        "nome, eta, sesso, sport_principali, livello_esperienza, obiettivi, gare_target, data_obiettivo, disponibilita_ore_sett, giorni_preferiti, giorni_impossibili, infortuni_attuali, dolore_attuale, limiti_principali, preferenze_allenamento, stile_allenamento, note_personali, filosofia_risposte, filosofia_coaching"
      )
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("athlete_metrics_snapshots")
      .select("mirror_data, data_quality_level")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("coach_decisions")
      .select("date, decision_type, recommendation")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_DECISIONS),
    admin
      .from("athlete_memory")
      .select("created_at, memory_type, nota")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_MEMORIES),
  ]);

  return condenseContext({
    dossier: (dossierRes.data ?? null) as DossierRow | null,
    mirror: (snapshotRes.data?.mirror_data ?? null) as MirrorData | null,
    dataQualityLevel: snapshotRes.data?.data_quality_level ?? null,
    decisions: (decisionsRes.data ?? []) as DecisionRow[],
    memories: (memoriesRes.data ?? []) as MemoryRow[],
  });
}
