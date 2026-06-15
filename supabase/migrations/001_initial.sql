-- ============================================================================
-- Coach IA Endurance — Migration 001: schema iniziale
--
-- Basata su PRD §20 (modello dati). Crea le 6 tabelle fondanti del MVP:
--   users, athlete_profiles, intervals_connections,
--   athlete_metrics_snapshots, coach_decisions, audit_logs
--
-- Principi applicati:
--  * L'autenticazione è gestita da Supabase Auth (schema `auth`); la nostra
--    `public.users` estende `auth.users` con i campi di prodotto (consensi,
--    piano, timezone). PK = FK verso auth.users così non possono esistere
--    utenti applicativi orfani.
--  * Read-only sui derivati (Section 11 "No Virtual Math"): i mirror JSON
--    (latest.json / history.json) si salvano così come arrivano, in colonne
--    JSONB. Nessuna colonna per metriche ricalcolate: CTL/ATL/TSB/ACWR/RI e
--    readiness_decision vivono DENTRO il JSON pre-calcolato da sync.py.
--  * Audit-first: coach_decisions conserva sia il validation_metadata
--    (schema Section 11 C) sia la copia del readiness_decision letto da
--    latest.json al momento della decisione, per riproducibilità.
--  * RLS ovunque: ogni utente vede solo le proprie righe. I job di sync
--    server-side useranno la service-role key, che bypassa RLS by design.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- users — estensione applicativa di auth.users (PRD §20.1)
-- Perché: Supabase Auth possiede email/password/OAuth; qui teniamo solo ciò
-- che il prodotto aggiunge (consensi GDPR espliciti ex art. 9(2)(a) — PRD
-- §24.2 — piano tariffario, timezone, soft delete).
-- ----------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  plan_type text not null default 'free'
    check (plan_type in ('free', 'base', 'pro', 'premium')),
  timezone text not null default 'Europe/Rome',
  -- Consensi espliciti e separati: dati salute (HRV, FC, sonno...) e
  -- trattamento via AI. Devono essere FALSE finché l'utente non acconsente
  -- in onboarding (PRD §12.1 step 3).
  consent_health_data boolean not null default false,
  consent_ai_processing boolean not null default false,
  created_at timestamptz not null default now(),
  -- Soft delete: la cancellazione account è un diritto GDPR ma le righe
  -- collegate (audit) possono richiedere retention; deleted_at marca
  -- l'account come chiuso prima della purge definitiva.
  deleted_at timestamptz
);

-- ----------------------------------------------------------------------------
-- athlete_profiles — il dossier atleta (PRD §12.2, §20.1)
-- Perché: dati dichiarati dall'utente (obiettivi, disponibilità, attrezzatura,
-- infortuni) che NON arrivano da Intervals.icu. 1:1 con users.
-- I campi compositi (obiettivi, vincoli, attrezzatura) sono JSONB perché la
-- loro struttura evolverà con l'onboarding senza richiedere migration.
-- ----------------------------------------------------------------------------
create table public.athlete_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  sport_primary text,
  sport_secondary text,
  birth_year integer check (birth_year is null or birth_year between 1900 and 2100),
  sex text check (sex is null or sex in ('M', 'F', 'other')),
  height_cm numeric(5, 1),
  weight_latest_kg numeric(5, 2),
  goals jsonb not null default '[]'::jsonb,
  target_events jsonb not null default '[]'::jsonb,
  weekly_hours_available numeric(4, 1),
  weekday_constraints jsonb not null default '{}'::jsonb,
  weekend_constraints jsonb not null default '{}'::jsonb,
  equipment jsonb not null default '{}'::jsonb,
  injury_notes text,
  preferences jsonb not null default '{}'::jsonb,
  experience_level text check (
    experience_level is null
    or experience_level in ('beginner', 'intermediate', 'advanced')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- intervals_connections — collegamento OAuth a Intervals.icu (PRD §9.4, §20.1)
-- Perché: i token OAuth sono credenziali verso dati salute; vanno salvati
-- SOLO cifrati (cifratura applicativa con TOKEN_ENCRYPTION_KEY prima
-- dell'INSERT — le colonne *_encrypted contengono ciphertext, mai plaintext).
-- 1:1 con users: un solo account Intervals per utente nel MVP.
-- ----------------------------------------------------------------------------
create table public.intervals_connections (
  user_id uuid primary key references public.users (id) on delete cascade,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  -- Scope concessi dall'utente (PRD §9.4: minimi necessari). Salvarli
  -- permette di rilevare connessioni con permessi insufficienti.
  scopes text[] not null default '{}',
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked', 'error'))
);

-- ----------------------------------------------------------------------------
-- athlete_metrics_snapshots — mirror JSON Section 11 (PRD §20.1, §9.2)
-- Perché: ogni sync salva uno snapshot immutabile di latest.json/history.json
-- prodotti da sync.py. L'app LEGGE da qui (readiness_decision,
-- derived_metrics...); non ricalcola nulla. Lo storico degli snapshot rende
-- ogni decisione del coach riproducibile: coach_decisions punta allo
-- snapshot esatto usato come input.
-- ----------------------------------------------------------------------------
create table public.athlete_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- Provenienza del mirror (Section 11 A: local files / connector / URL).
  source text not null default 'sync.py',
  snapshot_date date not null,
  latest_json jsonb not null,
  history_json jsonb,
  -- Livello qualità dati 0–4 (PRD §11): determina cosa il coach può
  -- legittimamente raccomandare con questi dati.
  data_quality_level smallint
    check (data_quality_level is null or data_quality_level between 0 and 4),
  created_at timestamptz not null default now()
);

-- Lookup tipico: "ultimo snapshot di questo utente".
create index athlete_metrics_snapshots_user_date_idx
  on public.athlete_metrics_snapshots (user_id, snapshot_date desc);

-- ----------------------------------------------------------------------------
-- coach_decisions — audit log decisionale del coach (PRD §20.1, §19, §23.3)
-- Perché: ogni Go/Modify/Skip, piano o report deve essere verificabile a
-- posteriori. Si conserva: lo snapshot di input (FK), le regole scattate,
-- il validation_metadata conforme a Section 11 C (con frameworks_cited) e
-- la copia letterale del readiness_decision letto da latest.json — così si
-- può dimostrare che la decisione mostrata coincide con quella pre-calcolata.
-- ----------------------------------------------------------------------------
create table public.coach_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  decision_type text not null check (
    decision_type in (
      'daily_readiness', 'weekly_plan', 'pre_workout_report',
      'post_workout_report', 'test_proposal', 'chat'
    )
  ),
  -- Per daily_readiness: GO | MODIFY | SKIP. Per altri tipi può essere
  -- una sintesi della raccomandazione.
  recommendation text not null,
  input_snapshot_id uuid
    references public.athlete_metrics_snapshots (id) on delete set null,
  rules_triggered jsonb not null default '[]'::jsonb,
  ai_summary text,
  validator_status text not null default 'pending'
    check (validator_status in ('pending', 'passed', 'failed', 'fallback')),
  -- Schema Section 11 C: checklist_passed/failed, protocol_version,
  -- frameworks_cited, confidence, missing_inputs, phase_detected...
  validation_metadata jsonb,
  -- Copia dell'oggetto readiness_decision letto da latest.json al momento
  -- della decisione (PRD §20.1). Ridondante rispetto allo snapshot per
  -- audit immediato anche se lo snapshot venisse purgato.
  readiness_decision_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index coach_decisions_user_date_idx
  on public.coach_decisions (user_id, date desc);

-- ----------------------------------------------------------------------------
-- audit_logs — log azioni di sistema (PRD §20.1, §24.2 "log accessi")
-- Perché: traccia generica di azioni rilevanti (sync, scritture calendario,
-- consensi, cancellazioni) distinta dalle decisioni di coaching. Append-only.
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  action text not null,
  source text not null default 'app',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_user_created_idx
  on public.audit_logs (user_id, created_at desc);

-- ============================================================================
-- Row Level Security
-- Perché: dati art. 9 GDPR (salute) — l'isolamento per utente deve valere a
-- livello database, non solo applicativo. La anon key passa SEMPRE da RLS;
-- i worker server-side (sync) usano la service-role key che la bypassa.
-- ============================================================================
alter table public.users enable row level security;
alter table public.athlete_profiles enable row level security;
alter table public.intervals_connections enable row level security;
alter table public.athlete_metrics_snapshots enable row level security;
alter table public.coach_decisions enable row level security;
alter table public.audit_logs enable row level security;

-- users: l'utente legge e aggiorna solo sé stesso. L'INSERT avviene
-- server-side alla registrazione (service role), quindi nessuna policy insert.
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- athlete_profiles: pieno controllo dell'utente sul proprio dossier.
create policy "profiles_select_own" on public.athlete_profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.athlete_profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.athlete_profiles
  for update using (auth.uid() = user_id);
create policy "profiles_delete_own" on public.athlete_profiles
  for delete using (auth.uid() = user_id);

-- intervals_connections: l'utente vede lo stato della propria connessione e
-- può scollegarla. Scrittura/refresh token solo server-side (service role):
-- il client non deve mai maneggiare token, nemmeno cifrati.
create policy "connections_select_own" on public.intervals_connections
  for select using (auth.uid() = user_id);
create policy "connections_delete_own" on public.intervals_connections
  for delete using (auth.uid() = user_id);

-- athlete_metrics_snapshots: sola lettura per l'utente; gli snapshot li
-- scrive solo il worker di sync (service role). Immutabili per audit.
create policy "snapshots_select_own" on public.athlete_metrics_snapshots
  for select using (auth.uid() = user_id);

-- coach_decisions: sola lettura per l'utente; le decisioni le scrive solo
-- il backend. Niente update/delete: l'audit log non si riscrive.
create policy "decisions_select_own" on public.coach_decisions
  for select using (auth.uid() = user_id);

-- audit_logs: sola lettura delle proprie voci; scrittura solo backend.
create policy "audit_select_own" on public.audit_logs
  for select using (auth.uid() = user_id);

-- ============================================================================
-- updated_at automatico su athlete_profiles
-- Perché: evita che il client debba (o possa dimenticare di) aggiornarlo.
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger athlete_profiles_set_updated_at
  before update on public.athlete_profiles
  for each row
  execute function public.set_updated_at();
