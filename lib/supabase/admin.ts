import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase ADMIN (service role) — SOLO lato server.
 *
 * Perché esiste: le tabelle intervals_connections, audit_logs e le colonne
 * Intervals di users sono scrivibili solo dal backend (le policy RLS non
 * prevedono insert/update dal client, by design: il browser non deve mai
 * maneggiare token, nemmeno cifrati). La service-role key bypassa RLS,
 * quindi questo modulo non va MAI importato da codice client — la chiave
 * non ha prefisso NEXT_PUBLIC_ proprio per non finire nel bundle browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // Nessuna sessione utente: questo client agisce come servizio.
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
