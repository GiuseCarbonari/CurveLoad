-- Filosofia di coaching (metà del Passo 12, anticipata).
--
-- Tre colonne su athlete_profiles, stesso schema dei commenti AI della
-- migration 017 (testo + timestamp di generazione): la tabella ha già RLS
-- per-utente dalla 001, quindi non serve altro.
--
-- filosofia_risposte è jsonb e NON text perché qui, a differenza del taccuino
-- del coach (021), il contenuto è strutturato: risposte a scelta chiusa più due
-- liste. La forma esatta la definisce lib/onboarding/dossier.ts (FilosofiaForm);
-- il DB tiene solo il contenitore, come già fa per gare_target e injury_periods.
alter table public.athlete_profiles
  add column if not exists filosofia_risposte jsonb,
  add column if not exists filosofia_coaching text,
  add column if not exists filosofia_coaching_at timestamptz;

comment on column public.athlete_profiles.filosofia_risposte is
  'Risposte dell''intervista sulla filosofia di coaching: scuole scelte (id di lib/coaching/schools.ts), storia, reazione ai blocchi duri, struttura/flessibilità, dati/sensazioni, tono, cosa piace e cosa detesta.';
comment on column public.athlete_profiles.filosofia_coaching is
  'Filosofia di coaching personale, generata dall''AI dalle risposte + dati reali dell''atleta. Prosa: entra nel fascicolo di ogni chiamata AI (lib/ai/context.ts).';
