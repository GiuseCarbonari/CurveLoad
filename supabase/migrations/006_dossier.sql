-- ============================================================================
-- Coach IA Endurance — Migration 006: dossier atleta + onboarding (PRD §12)
--
-- Aggiunge ad athlete_profiles i campi del dossier (§12.2) come colonne
-- esplicite (nomi italiani, coerenti con il form di onboarding) più lo stato
-- del wizard (onboarding_completed / onboarding_step), e a users il consenso
-- privacy (§12.1 step 3 — la spec del milestone lo vuole su users.gdpr_consent,
-- che non esisteva: qui lo creiamo).
--
-- NOTA progettuale: la migration 001 aveva già modellato il dossier con
-- colonne inglesi/JSONB (sport_primary, sex, height_cm, goals, target_events,
-- weekday_constraints, equipment, …) come placeholder. Onboarding e
-- /settings/profile scrivono sulle nuove colonne italiane qui sotto; le vecchie
-- restano inutilizzate (additive, nessuna collisione) — da consolidare in una
-- migration futura se si vuole una sola fonte di verità.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- users — consenso privacy e dati salute (§12.1 step 3)
-- Unico vincolo obbligatorio dell'onboarding insieme al nome. Default false:
-- nessun trattamento finché l'utente non acconsente esplicitamente in wizard.
-- ----------------------------------------------------------------------------
alter table public.users
  add column gdpr_consent boolean not null default false;

-- ----------------------------------------------------------------------------
-- athlete_profiles — campi dossier (§12.2) + stato onboarding
-- Nessun campo è obbligatorio a livello DB (regola del milestone: l'app
-- funziona anche con dati parziali). L'unico obbligo (nome + consenso) è
-- applicato lato applicazione nel wizard.
-- ----------------------------------------------------------------------------
alter table public.athlete_profiles
  -- Pagina A del dossier
  add column nome text,
  add column eta integer,
  add column sesso text,
  add column altezza_cm integer,
  add column peso_dichiarato_kg numeric(5, 2),
  add column sport_principali text[],
  add column livello_esperienza text,
  -- Pagina B del dossier
  add column obiettivi text,
  add column gare_target jsonb,
  add column data_obiettivo date,
  add column disponibilita_ore_sett numeric(4, 1),
  add column giorni_preferiti text[],
  add column giorni_impossibili text[],
  add column durata_max_weekday_min integer,
  add column durata_max_weekend_min integer,
  -- Attrezzatura e contesto
  add column indoor_outdoor text,
  add column ha_rulli boolean,
  add column ha_misuratore_potenza boolean,
  add column ha_fascia_cardio boolean,
  add column ha_smartwatch boolean,
  -- Limiti, infortuni, note
  add column infortuni_attuali text,
  add column dolore_attuale text,
  add column preferenze_allenamento text,
  add column limiti_principali text,
  add column note_personali text,
  -- Stato del wizard: onboarding_completed=true SOLO allo step 7;
  -- onboarding_step ricorda dove ripartire se l'utente chiude a metà.
  add column onboarding_completed boolean not null default false,
  add column onboarding_step integer not null default 0;
