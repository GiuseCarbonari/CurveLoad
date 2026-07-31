-- Passo 2 (BYOK): chiave Groq personale per-utente, cifrata con lo stesso
-- pattern dei token Intervals (lib/crypto.ts, TOKEN_ENCRYPTION_KEY). Nullable:
-- chi non la imposta usa il fallback GROQ_API_KEY (vedi lib/ai/resolve-key.ts).
-- Nessuna nuova policy RLS: "users_update_own"/"users_select_own" (migration
-- 001) bastano già; il codice applicativo non seleziona mai questa colonna
-- verso il client (stesso discorso di access_token_encrypted).
alter table public.users
  add column groq_key_encrypted text;
