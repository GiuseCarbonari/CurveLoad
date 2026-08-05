-- Review settimanale: chiude la settimana appena finita confrontando piano
-- (weekly_plans) e reale (attività Intervals), incrociando le tue risposte
-- su come ti sei sentito con quello che dicono i numeri.
--
-- Pattern RLS/upsert identico a weekly_plans (migration 008): una riga
-- "corrente" per (utente, settimana), scrittura solo backend (service role).
-- `metrics` salva TUTTI i numeri calcolati dal motore (non solo quelli citati
-- nella prosa), così la review resta riproducibile e auditabile anche se il
-- testo AI viene rigenerato in futuro.
create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- Lunedì della settimana chiusa che questa review racconta.
  week_start date not null,
  -- Le tue risposte al questionario (energia, sonno, dolori, stress,
  -- motivazione, sedute migliori/peggiori) — prosa breve, mai libera oltre
  -- quanto il modulo consente.
  feel jsonb not null default '{}'::jsonb,
  -- Tutto ciò che il motore ha calcolato: volume/dislivello/carico reali,
  -- abbinamento piano↔reale per seduta, decoupling e tempo in zona dagli
  -- stream, divergenze sensazioni↔dati, tendenze con le loro prove.
  metrics jsonb not null default '{}'::jsonb,
  -- Prosa AI (Groq): solo racconto, mai fonte di numeri nuovi.
  narrative text,
  generated_at timestamptz not null default now()
);

-- Una sola riga "corrente" per (utente, settimana): rigenerare fa upsert.
create unique index weekly_reviews_user_week_idx
  on public.weekly_reviews (user_id, week_start);

-- Lookup tipico: "ultime review di questo utente" (per i trend fra settimane).
create index weekly_reviews_user_generated_idx
  on public.weekly_reviews (user_id, generated_at desc);

alter table public.weekly_reviews enable row level security;

create policy "weekly_reviews_select_own" on public.weekly_reviews
  for select using (auth.uid() = user_id);
