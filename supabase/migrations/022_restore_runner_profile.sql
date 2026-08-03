-- Passo 9 (Modulo Corsa, parte 1) — ripristino di runner_profile_data.
-- Annulla la 019, che si dichiarava reversibile. Stesso identico statement
-- della 015: colonna JSONB separata da profile_data (che resta il profilo
-- BICI) perché fonte e schema sono diversi (power-curves vs pace-curves).
-- Nessuna tabella nuova → nessuna policy nuova: athlete_profiles ha già RLS
-- per-utente dalla migration 001 (profiles_select/insert/update/delete_own)
-- e il trigger athlete_profiles_set_updated_at.
alter table public.athlete_profiles
  add column if not exists runner_profile_data jsonb;
