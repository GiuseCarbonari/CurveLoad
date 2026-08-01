import { assembleAthleteContext } from "@/lib/ai/context";
import { GroqCallError, callLlm, DEFAULT_AI_MODEL } from "@/lib/ai/groq";
import {
  buildPercorsoExplainPrompt,
  type PercorsoEvent,
} from "@/lib/ai/percorso-explain-prompt";
import { findUnexpectedNumbers } from "@/lib/ai/profile-explain-prompt";
import { resolveGroqKey } from "@/lib/ai/resolve-key";
import type { GapAnalysisResult } from "@/lib/terrain/gap-analysis";
import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import type { RaceEstimateV2 } from "@/lib/terrain/race-estimator-v2";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Orchestratore I/O del commento AI "percorso" (Passo 6) — stesso pattern di
 * lib/profile/explain-io.ts, applicato all'analisi evento invece che al
 * profilo. Legge gap_analysis + event_terrain (+ race_estimate se presente),
 * già salvati da /api/profile/gap-analysis: non ricalcola nulla.
 */

export type ExplainPercorsoOutcome =
  | { ok: true; comment: string; generated_at: string }
  | {
      ok: false;
      reason: "no_analysis" | "no_api_key" | "invalid_user_key" | "ai_error" | "internal_error";
    };

interface SavedGapAnalysisRow extends GapAnalysisResult {
  event: PercorsoEvent;
}

export async function explainRoutePercorso(userId: string): Promise<ExplainPercorsoOutcome> {
  const resolvedKey = await resolveGroqKey(userId);
  if (!resolvedKey) return { ok: false, reason: "no_api_key" };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("athlete_profiles")
    .select("gap_analysis, event_terrain, race_estimate")
    .eq("user_id", userId)
    .maybeSingle();
  const analysis = (row?.gap_analysis ?? null) as SavedGapAnalysisRow | null;
  const terrain = (row?.event_terrain ?? null) as TerrainSummary | null;
  const raceEstimate = (row?.race_estimate ?? null) as RaceEstimateV2 | null;
  if (!analysis || !terrain) return { ok: false, reason: "no_analysis" };

  const context = await assembleAthleteContext(userId);
  const prompt = buildPercorsoExplainPrompt(
    terrain,
    analysis,
    analysis.event,
    raceEstimate,
    context
  );

  let rawText: string;
  try {
    rawText = await callLlm({
      apiKey: resolvedKey.apiKey,
      system: prompt.system,
      userMessage: prompt.user,
      // Due paragrafi, ma densi di dati (limitatori + pacing per tratto):
      // 500 token si sono rivelati insufficienti in pratica (l'italiano usa
      // più token per parola dell'inglese) e tagliavano la risposta a metà
      // frase. 800 = stesso budget del commento profilo (3 paragrafi).
      maxTokens: 800,
    });
  } catch (error) {
    // Chiave PROPRIA rifiutata da Groq: niente fallback silenzioso (PIANO.md Passo 2).
    if (error instanceof GroqCallError && error.status === 401 && resolvedKey.source === "user") {
      return { ok: false, reason: "invalid_user_key" };
    }
    const detail =
      error instanceof GroqCallError
        ? `${error.status} ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    console.error("Commento AI percorso fallito:", detail);
    return { ok: false, reason: "ai_error" };
  }

  const comment = rawText.trim();
  const generatedAt = new Date().toISOString();
  const { error: saveError } = await admin
    .from("athlete_profiles")
    .update({ ai_comment_percorso: comment, ai_comment_percorso_at: generatedAt })
    .eq("user_id", userId);
  if (saveError) {
    console.error("Salvataggio commento AI percorso fallito:", saveError.message);
    return { ok: false, reason: "internal_error" };
  }

  // Check anti-numeri-inventati: log-only, non blocca il salvataggio (è prosa).
  const unexpectedNumbers = findUnexpectedNumbers(comment, prompt.allowedNumbers);
  await admin.from("audit_logs").insert({
    user_id: userId,
    action: "profile.ai_explain_percorso",
    source: "explain_percorso",
    payload: {
      model: DEFAULT_AI_MODEL,
      comment_chars: comment.length,
      unexpected_numbers: unexpectedNumbers,
      event_name: analysis.event.name,
      climbs: terrain.climbs.length,
    },
  });

  return { ok: true, comment, generated_at: generatedAt };
}
