import { assembleAthleteContext } from "@/lib/ai/context";
import { GroqCallError, callLlm, DEFAULT_AI_MODEL } from "@/lib/ai/groq";
import { buildOggiExplainPrompt } from "@/lib/ai/oggi-explain-prompt";
import { findUnexpectedNumbers } from "@/lib/ai/profile-explain-prompt";
import { resolveGroqKey } from "@/lib/ai/resolve-key";
import type { MirrorData } from "@/lib/intervals/sync";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Orchestratore I/O del commento AI "oggi" (Passo 6) — stesso pattern di
 * lib/profile/explain-io.ts, applicato alla prontezza del giorno invece che
 * al profilo. Legge l'ultimo mirror (già scritto dal sync): NON ricalcola
 * la readiness, la legge (mirror.readiness_today).
 */

export type ExplainOggiOutcome =
  | { ok: true; comment: string; generated_at: string }
  | {
      ok: false;
      reason: "no_data" | "no_api_key" | "invalid_user_key" | "ai_error" | "internal_error";
    };

export async function explainTodayReadiness(userId: string): Promise<ExplainOggiOutcome> {
  const resolvedKey = await resolveGroqKey(userId);
  if (!resolvedKey) return { ok: false, reason: "no_api_key" };

  const admin = createAdminClient();
  const { data: snapshot } = await admin
    .from("athlete_metrics_snapshots")
    .select("mirror_data")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const mirror = (snapshot?.mirror_data ?? null) as MirrorData | null;
  if (!mirror) return { ok: false, reason: "no_data" };

  const context = await assembleAthleteContext(userId);
  const prompt = buildOggiExplainPrompt(mirror.readiness_today, context);

  let rawText: string;
  try {
    rawText = await callLlm({
      apiKey: resolvedKey.apiKey,
      system: prompt.system,
      userMessage: prompt.user,
      // Un solo paragrafo breve: budget più corto del commento profilo.
      maxTokens: 350,
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
    console.error("Commento AI oggi fallito:", detail);
    return { ok: false, reason: "ai_error" };
  }

  const comment = rawText.trim();
  const generatedAt = new Date().toISOString();
  const { error: saveError } = await admin
    .from("athlete_profiles")
    .update({ ai_comment_oggi: comment, ai_comment_oggi_at: generatedAt })
    .eq("user_id", userId);
  if (saveError) {
    console.error("Salvataggio commento AI oggi fallito:", saveError.message);
    return { ok: false, reason: "internal_error" };
  }

  // Check anti-numeri-inventati: log-only, non blocca il salvataggio (è prosa).
  const unexpectedNumbers = findUnexpectedNumbers(comment, prompt.allowedNumbers);
  await admin.from("audit_logs").insert({
    user_id: userId,
    action: "dashboard.ai_explain_oggi",
    source: "explain_oggi",
    payload: {
      model: DEFAULT_AI_MODEL,
      comment_chars: comment.length,
      unexpected_numbers: unexpectedNumbers,
      decision: mirror.readiness_today.decision,
    },
  });

  return { ok: true, comment, generated_at: generatedAt };
}
