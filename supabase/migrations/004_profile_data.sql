-- ============================================================================
-- Coach IA Endurance — Migration 004: profilo fenotipo (Milestone 3)
--
-- profile_data ospita l'oggetto profile.json del Modulo Profilo Atleta
-- (PRD §33 schema D): RPP, CP/W', APR/MPR, fenotipo. JSONB perché lo schema
-- del profilo evolverà (gap analysis al prossimo passo) senza migration.
-- La riga athlete_profiles viene creata al primo "Aggiorna profilo" se
-- l'onboarding non l'ha ancora creata (upsert via RLS, policy esistenti).
-- ============================================================================

alter table public.athlete_profiles
  add column profile_data jsonb;
