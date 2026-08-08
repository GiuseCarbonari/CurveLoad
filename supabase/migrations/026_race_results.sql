-- Risultati di gara passati (corsa), per le previsioni Riegel.
--
-- Perché esiste: il motore CS/D' (pace-profile.ts) stima i tempi gara dalla
-- curva di ALLENAMENTO (2-15 min) e si ferma apposta prima di mezza/maratona
-- perché fuori da quella finestra sarebbero numeri inventati. La formula di
-- Riegel (T2 = T1 * (D2/D1)^k) lavora invece da un RISULTATO DI GARA VERO e
-- copre proprio le distanze lunghe che CS/D' rifiuta di stimare — ma un
-- risultato di gara passato non aveva nessun posto dove vivere: gare_target
-- (athlete_profiles) tiene solo gare FUTURE, mai un tempo.
--
-- Tabella separata (non un flag "completata" su gare_target): gare_target è
-- letta dal macrociclo per pianificare i blocchi a ritroso da una data
-- futura — mescolarci risultati passati costringerebbe ogni lettore presente
-- e futuro a filtrare "completata sì/no".
--
-- `livello_preparazione` è un'etichetta auto-dichiarata (mai un coefficiente
-- nella formula, la formula si spiega da sé): dice quanto fidarsi del
-- risultato come base di calcolo, la decisione resta sempre del motore, mai
-- del dato soggettivo.
--
-- Pattern RLS identico a 025_weekly_reviews.sql: sola policy select-own,
-- scrittura esclusiva da service role (route API, dopo validazione).
create table public.race_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  nome text,
  data date not null,
  distanza_km numeric not null,
  tempo_finale_s integer not null,
  livello_preparazione text check (
    livello_preparazione in ('ben_allenato', 'nella_media', 'sottopreparato')
  ),
  note text,
  -- Auto-report facoltativo di cosa prevedeva l'orologio per QUELLA gara:
  -- mai calcolato dall'app, va sempre mostrato come dato non verificato.
  stima_orologio_s integer,
  created_at timestamptz not null default now()
);

-- Rete di sicurezza contro il doppio invio dello stesso risultato dal form,
-- non un vincolo di dominio (una persona può correre due gare della stessa
-- distanza in date diverse, quello resta permesso).
create unique index race_results_no_dup
  on public.race_results (user_id, data, distanza_km);

create index race_results_user_data_idx
  on public.race_results (user_id, data desc);

alter table public.race_results enable row level security;

create policy "race_results_select_own" on public.race_results
  for select using (auth.uid() = user_id);
