-- ============================================================================
-- Coach IA Endurance — Migration 009: stima tempi e pacing gara (PRD §33)
--
-- race_estimate ospita i tre scenari (ottimistico/realistico/conservativo) e
-- il piano di pacing calcolati in modo deterministico da event_terrain +
-- profile_data (CP, peso) — nessuna API, nessuna AI. Si (ri)calcola col
-- bottone "Aggiorna stima" e automaticamente dopo una nuova analisi evento.
--
-- NB: numerazione 009 come da spec del milestone (la 008 non esiste in questo
-- repo — gap volontario lato prodotto).
-- ============================================================================

alter table public.athlete_profiles
  add column race_estimate jsonb,
  add column race_estimate_at timestamptz;
