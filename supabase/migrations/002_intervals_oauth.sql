-- ============================================================================
-- Coach IA Endurance — Migration 002: adeguamento OAuth Intervals.icu
--
-- Basata sugli endpoint OAuth VERIFICATI di Intervals.icu (Milestone 1,
-- vedi docs/INTERVALS_API_NOTES.md). Fatto chiave emerso dalla verifica:
-- Intervals.icu NON emette refresh token — l'access token è permanente.
-- Lo schema 001 (scritto prima della verifica) prevedeva refresh token e
-- scadenza: qui si corregge.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- users — identità Intervals dell'utente
-- Perché: dopo il collegamento OAuth conserviamo id e nome atleta restituiti
-- dalla token response (unico dato atleta consentito in Milestone 1).
-- ----------------------------------------------------------------------------
alter table public.users
  add column intervals_athlete_id text,
  add column intervals_athlete_name text;

-- ----------------------------------------------------------------------------
-- intervals_connections — allineamento al flusso OAuth reale
-- ----------------------------------------------------------------------------
-- refresh_token_encrypted: Intervals.icu non emette refresh token.
-- expires_at: l'access token è permanente, non scade.
-- scopes (text[]): sostituita da granted_scopes (text), copia letterale
--   del campo `scope` della token response — fedeltà alla fonte, nessuna
--   trasformazione che possa introdurre discrepanze.
alter table public.intervals_connections
  drop column refresh_token_encrypted,
  drop column expires_at,
  drop column scopes;

-- La tabella è vuota a questo punto della storia migrazioni, quindi le
-- colonne NOT NULL si possono aggiungere senza default.
alter table public.intervals_connections
  add column intervals_athlete_id text not null,
  add column intervals_athlete_name text,
  add column granted_scopes text not null;

-- ----------------------------------------------------------------------------
-- Creazione automatica della riga public.users alla registrazione
-- Perché: la policy RLS su users non prevede INSERT dal client (by design);
-- senza questo trigger un nuovo utente Supabase Auth non avrebbe la riga
-- applicativa e il callback OAuth non saprebbe dove scrivere l'identità
-- Intervals. SECURITY DEFINER perché il trigger scrive su public.users
-- bypassando RLS, con search_path bloccato per sicurezza.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
