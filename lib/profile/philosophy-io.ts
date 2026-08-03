import { assembleAthleteContext } from "@/lib/ai/context";
import { GroqCallError, callLlm, DEFAULT_AI_MODEL } from "@/lib/ai/groq";
import { buildPhilosophyPrompt } from "@/lib/ai/philosophy-prompt";
import { findUnexpectedNumbers } from "@/lib/ai/profile-explain-prompt";
import { resolveGroqKey } from "@/lib/ai/resolve-key";
import type { FilosofiaForm } from "@/lib/onboarding/dossier";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Orchestratore I/O della filosofia di coaching — stesso pattern di
 * lib/profile/explain-io.ts (lettura DB → funzione pura → chiamata esterna →
 * scrittura DB → audit_logs). La costruzione del prompt resta pura in
 * lib/ai/philosophy-prompt.ts.
 *
 * Scrive filosofia_coaching + filosofia_coaching_at (migration 023). NON tocca
 * stile_allenamento: quello lo decide l'intervista (formToPatch), non l'AI —
 * il motore deterministico resta l'autorità su ciò che cambia il piano.
 */

export type PhilosophyOutcome =
  | { ok: true; philosophy: string; generated_at: string }
  | {
      ok: false;
      reason:
        | "no_answers"
        | "no_api_key"
        | "invalid_user_key"
        | "ai_error"
        | "internal_error";
    };

export async function writeCoachingPhilosophy(
  userId: string
): Promise<PhilosophyOutcome> {
  const resolvedKey = await resolveGroqKey(userId);
  if (!resolvedKey) return { ok: false, reason: "no_api_key" };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("athlete_profiles")
    .select("filosofia_risposte, stile_allenamento")
    .eq("user_id", userId)
    .maybeSingle();

  const risposte = (row?.filosofia_risposte ?? null) as FilosofiaForm | null;
  // Senza intervista non c'è filosofia da scrivere: il coach inventerebbe un
  // atleta. Meglio rimandare l'utente alle domande.
  if (!risposte) return { ok: false, reason: "no_answers" };

  const context = await assembleAthleteContext(userId);
  const prompt = buildPhilosophyPrompt(
    risposte,
    (row?.stile_allenamento ?? null) as string | null,
    context
  );

  let philosophy: string;
  try {
    philosophy = (
      await callLlm({
        apiKey: resolvedKey.apiKey,
        system: prompt.system,
        userMessage: prompt.user,
        // 4 paragrafi in italiano: stesso budget del commento profilo, un po'
        // più largo perché qui i paragrafi sono quattro e non tre.
        maxTokens: 900,
      })
    ).trim();
  } catch (error) {
    if (
      error instanceof GroqCallError &&
      error.status === 401 &&
      resolvedKey.source === "user"
    ) {
      return { ok: false, reason: "invalid_user_key" };
    }
    const detail =
      error instanceof GroqCallError
        ? `${error.status} ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    console.error("Filosofia di coaching fallita:", detail);
    return { ok: false, reason: "ai_error" };
  }

  const generatedAt = new Date().toISOString();
  const { error: saveError } = await admin
    .from("athlete_profiles")
    .update({
      filosofia_coaching: philosophy,
      filosofia_coaching_at: generatedAt,
    })
    .eq("user_id", userId);
  if (saveError) {
    console.error("Salvataggio filosofia fallito:", saveError.message);
    return { ok: false, reason: "internal_error" };
  }

  const unexpectedNumbers = findUnexpectedNumbers(philosophy, prompt.allowedNumbers);
  await admin.from("audit_logs").insert({
    user_id: userId,
    action: "profile.ai_philosophy",
    source: "philosophy",
    payload: {
      model: DEFAULT_AI_MODEL,
      philosophy_chars: philosophy.length,
      unexpected_numbers: unexpectedNumbers,
      schools: prompt.schools.map((s) => s.id),
      schools_suggested: prompt.suggested,
      stile_allenamento: row?.stile_allenamento ?? null,
      context_sections: {
        atleta: context.atleta != null,
        condizione: context.condizione != null,
        decisioni_recenti: context.decisioni_recenti.length,
        memoria: context.memoria.length,
      },
    },
  });

  return { ok: true, philosophy, generated_at: generatedAt };
}
