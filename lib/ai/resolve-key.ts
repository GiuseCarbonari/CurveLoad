import { decryptToken } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Risoluzione chiave Groq per utente (Passo 2 — BYOK): chiave propria se
 * configurata, altrimenti fallback sulla chiave condivisa del server.
 * `source` distingue le due strade: un 401 su una chiave "user" è un
 * problema della SUA chiave (niente fallback silenzioso — messaggio chiaro
 * in explain-io.ts), un 401 su "fallback" è un problema lato server.
 */

export interface ResolvedKey {
  apiKey: string;
  source: "user" | "fallback";
}

/** Puro: dati i due candidati, decide quale usare. */
export function pickApiKey(
  userKey: string | null,
  fallbackKey: string | null
): ResolvedKey | null {
  if (userKey) return { apiKey: userKey, source: "user" };
  if (fallbackKey) return { apiKey: fallbackKey, source: "fallback" };
  return null;
}

/** I/O: legge la chiave cifrata dell'utente (service role, mai esposta al client) e applica pickApiKey. */
export async function resolveGroqKey(userId: string): Promise<ResolvedKey | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("groq_key_encrypted")
    .eq("id", userId)
    .maybeSingle<{ groq_key_encrypted: string | null }>();

  const userKey = data?.groq_key_encrypted ? decryptToken(data.groq_key_encrypted) : null;
  return pickApiKey(userKey, process.env.GROQ_API_KEY ?? null);
}
