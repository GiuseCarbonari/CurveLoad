-- ============================================================================
-- Coach IA Endurance — Migration 008: piano settimanale (M6, PRD §15, Section 11 B)
--
-- Il planner deterministico (lib/planner/*) rileva la fase, seleziona le sedute
-- dalla Workout Library e costruisce la settimana completa (§15.4). Il piano si
-- salva qui — una riga per settimana per utente — così la pagina /plan lo legge
-- senza rigenerarlo ad ogni visita (bottone "Genera settimana" per (ri)generare).
--
-- Le singole decisioni di seduta restano tracciate anche in coach_decisions
-- (decision_type='weekly_plan', una riga per sessione) con il loro
-- validation_metadata Section 11 C: questa tabella è la vista "settimana".
--
-- JSONB per sessions/validation_metadata: lo schema (§15.4 + §11C) evolverà
-- senza richiedere migration. Scrittura solo backend (service role); l'utente
-- legge solo le proprie righe (RLS).
-- ============================================================================

create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- Lunedì della settimana coperta dal piano.
  week_start date not null,
  -- Fase rilevata: base | build | peak | taper | recovery (lib/planner/phase-detector).
  phase text not null,
  -- Array delle sedute costruite (BuiltSession[], PRD §15.4) + giorni di riposo.
  sessions jsonb not null default '[]'::jsonb,
  -- Narrativa AI opzionale (solo spiegazione; null se ANTHROPIC_API_KEY assente).
  narrative text,
  -- Header di audit del piano (Section 11 B §6 / §11C): fase, conteggio dure,
  -- spacing 48h, stima polarizzazione/volume, checklist, frameworks_cited.
  validation_metadata jsonb,
  generated_at timestamptz not null default now()
);

-- Una sola riga "corrente" per (utente, settimana): rigenerare fa upsert.
create unique index weekly_plans_user_week_idx
  on public.weekly_plans (user_id, week_start);

-- Lookup tipico: "ultimo piano di questo utente".
create index weekly_plans_user_generated_idx
  on public.weekly_plans (user_id, generated_at desc);

-- ----------------------------------------------------------------------------
-- RLS: dati di allenamento personali. L'utente legge SOLO le proprie righe;
-- la scrittura avviene server-side col service role (bypassa RLS), come per
-- coach_decisions/snapshots. Niente policy di insert/update per l'utente.
-- ----------------------------------------------------------------------------
alter table public.weekly_plans enable row level security;

create policy "weekly_plans_select_own" on public.weekly_plans
  for select using (auth.uid() = user_id);
