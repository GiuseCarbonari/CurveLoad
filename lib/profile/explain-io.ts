import { extractCoachNotes } from "@/lib/ai/coach-memory";
import { assembleAthleteContext } from "@/lib/ai/context";
import { GroqCallError, callLlm, DEFAULT_AI_MODEL } from "@/lib/ai/groq";
import {
  buildProfileExplainPrompt,
  findUnexpectedNumbers,
} from "@/lib/ai/profile-explain-prompt";
import { resolveGroqKey } from "@/lib/ai/resolve-key";
import type { AthleteProfileData } from "@/lib/profile/build-profile";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Orchestratore I/O del commento AI sul profilo — stesso pattern di
 * lib/profile/durability-io.ts (lettura DB → funzione pura → chiamata
 * esterna → scrittura DB → audit_logs). NON è puro; la costruzione del
 * prompt e il check numeri restano puri in lib/ai/profile-explain-prompt.ts.
 *
 * Scrive ai_comment_profilo + ai_comment_profilo_at (mai profile_data: il
 * trigger updated_at scatta comunque, ma la freschezza del profilo si misura
 * su profile_data.meta.generated_at, che qui non viene toccato) e — Passo 5 —
 * le note del taccuino in athlete_memory, via output vincolato
 * (lib/ai/coach-memory.ts).
 */

export type ExplainOutcome =
  | { ok: true; comment: string; generated_at: string }
  | {
      ok: false;
      reason: "no_profile" | "no_api_key" | "invalid_user_key" | "ai_error" | "internal_error";
    };

export async function explainAthleteProfile(userId: string): Promise<ExplainOutcome> {
  const resolvedKey = await resolveGroqKey(userId);
  if (!resolvedKey) return { ok: false, reason: "no_api_key" };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("athlete_profiles")
    .select("profile_data")
    .eq("user_id", userId)
    .maybeSingle();
  const profile = (row?.profile_data ?? null) as AthleteProfileData | null;
  if (!profile) return { ok: false, reason: "no_profile" };

  // Passo 4: il fascicolo completo (dossier, condizione, decisioni recenti)
  // entra in ogni chiamata AI — qui il primo call site.
  const context = await assembleAthleteContext(userId);
  const prompt = buildProfileExplainPrompt(profile, context);

  let rawText: string;
  try {
    rawText = await callLlm({
      apiKey: resolvedKey.apiKey,
      system: prompt.system,
      userMessage: prompt.user,
      // I 3 paragrafi + la riga NOTE_COACH (Passo 5) nello stesso budget.
      maxTokens: 800,
    });
  } catch (error) {
    // Chiave PROPRIA rifiutata da Groq: niente fallback silenzioso, l'utente
    // deve sapere che è la sua chiave a non andare (PIANO.md Passo 2).
    if (error instanceof GroqCallError && error.status === 401 && resolvedKey.source === "user") {
      return { ok: false, reason: "invalid_user_key" };
    }
    const detail =
      error instanceof GroqCallError
        ? `${error.status} ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    console.error("Commento AI profilo fallito:", detail);
    return { ok: false, reason: "ai_error" };
  }

  // Passo 5 (taccuino del coach): la riga NOTE_COACH viene staccata dal
  // commento e validata; all'utente arriva solo la prosa. Se il modello
  // rispondesse con la sola riga note, si ripiega sul testo grezzo.
  const { comment: stripped, notes, discarded } = extractCoachNotes(rawText);
  const comment = stripped || rawText.trim();

  const generatedAt = new Date().toISOString();
  const { error: saveError } = await admin
    .from("athlete_profiles")
    .update({ ai_comment_profilo: comment, ai_comment_profilo_at: generatedAt })
    .eq("user_id", userId);
  if (saveError) {
    console.error("Salvataggio commento AI fallito:", saveError.message);
    return { ok: false, reason: "internal_error" };
  }

  // Le note sopravvissute al validatore finiscono nel taccuino. Dedup esatto
  // via unique index (user_id, nota) + DO NOTHING; errore non fatale — il
  // commento è già salvato, il taccuino è un bonus.
  if (notes.length > 0) {
    const { error: memError } = await admin.from("athlete_memory").upsert(
      notes.map((n) => ({ user_id: userId, memory_type: n.tipo, nota: n.nota })),
      { onConflict: "user_id,nota", ignoreDuplicates: true }
    );
    if (memError) {
      console.error("Salvataggio note coach fallito:", memError.message);
    }
  }

  // Check anti-numeri-inventati: log-only, non blocca il salvataggio (è
  // prosa). Diventerà bloccante solo se/quando alimenterà il cron senza
  // revisione umana.
  const unexpectedNumbers = findUnexpectedNumbers(comment, prompt.allowedNumbers);
  await admin.from("audit_logs").insert({
    user_id: userId,
    action: "profile.ai_explain",
    source: "profile_explain",
    payload: {
      model: DEFAULT_AI_MODEL,
      comment_chars: comment.length,
      unexpected_numbers: unexpectedNumbers,
      context_sections: {
        atleta: context.atleta != null,
        condizione: context.condizione != null,
        decisioni_recenti: context.decisioni_recenti.length,
        memoria: context.memoria.length,
      },
      coach_notes_saved: notes.length,
      coach_notes_discarded: discarded,
    },
  });

  return { ok: true, comment, generated_at: generatedAt };
}
