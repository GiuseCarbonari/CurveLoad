import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase per il SERVER (Server Components, Route Handlers, Server Actions).
 *
 * Perché esiste: lato server la sessione utente vive nei cookie della
 * richiesta, non in localStorage. Questo client legge/scrive i cookie di
 * sessione così che le query rispettino l'identità dell'utente loggato
 * (e quindi le policy RLS), anche durante il rendering server-side.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // set() fallisce se chiamato da un Server Component puro:
            // lì i cookie sono read-only. È atteso e innocuo quando il
            // refresh della sessione è gestito altrove (es. middleware).
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Vedi nota sopra: read-only nei Server Component puri.
          }
        },
      },
    }
  );
}
