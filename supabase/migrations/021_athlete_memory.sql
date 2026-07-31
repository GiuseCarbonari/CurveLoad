-- Passo 5: athlete_memory — il "taccuino del coach". Note brevi che l'AI
-- annota sull'atleta (via output vincolato, mai testo libero → DB) e che
-- rientrano nel fascicolo di ogni chiamata futura (lib/ai/context.ts).
-- Pattern RLS della migration 001: per-utente, lettura propria, scrittura
-- solo backend (service role), niente update/delete — le note si accumulano.
-- ponytail: `nota` è prosa → text, non jsonb; se un giorno servirà una nota
-- strutturata (es. valori con unità) si aggiunge una colonna jsonb allora.
create table public.athlete_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- Allowlist condivisa col validatore applicativo (lib/ai/coach-memory.ts):
  -- il vincolo DB è l'ultima rete anche se il codice sbagliasse.
  memory_type text not null check (
    memory_type in ('preferenza', 'infortunio', 'traguardo', 'osservazione')
  ),
  nota text not null check (char_length(nota) between 1 and 300),
  -- Quale flusso AI ha scritto la nota (profile_explain oggi; oggi/percorso/
  -- chat nei prossimi passi) — per capire da dove arriva una nota strana.
  source text not null default 'profile_explain',
  created_at timestamptz not null default now()
);

-- Lookup tipico: "ultime note di questo utente".
create index athlete_memory_user_created_idx
  on public.athlete_memory (user_id, created_at desc);

-- Dedup esatto a livello DB: la stessa identica nota non si accumula
-- (l'insert usa ON CONFLICT DO NOTHING). Le quasi-uguali le evita il prompt
-- ("non ripetere note già in memoria").
create unique index athlete_memory_user_nota_key
  on public.athlete_memory (user_id, nota);

alter table public.athlete_memory enable row level security;

-- Sola lettura per l'utente; le note le scrive solo il backend (service
-- role), come coach_decisions: il taccuino non si riscrive dal client.
create policy "memory_select_own" on public.athlete_memory
  for select using (auth.uid() = user_id);
