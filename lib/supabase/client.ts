import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase per il BROWSER (Client Components).
 *
 * Usa solo la anon key pubblica: i dati restano protetti dalle policy
 * Row Level Security definite in supabase/migrations/001_initial.sql —
 * ogni utente vede esclusivamente le proprie righe.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
