-- ============================================================================
-- Coach IA Endurance — Migration 010: firma di velocità (M7, stima a 3 livelli)
--
-- La calibrazione (lib/terrain/velocity-signature.ts) impara la velocità reale
-- dell'atleta per fascia di pendenza dalle sue attività MTB (Livello 1), con
-- fallback all'archetipo MTB (Livello 2). La firma si salva qui così la stima
-- tempi (race-estimator-v2) la riusa senza riscaricare gli stream ad ogni volta
-- (bottone "Calibra"/"Ricalibra" per (ri)costruirla; trigger automatico nel
-- sync se l'atleta ha abbastanza uscite MTB).
--
-- JSONB perché lo schema della firma (buckets per fascia) evolverà senza
-- migration. signature_level esplicito per gating UI (badge L1/L2/non calibrato).
-- ============================================================================

alter table public.athlete_profiles
  -- VelocitySignature completa (buckets, level, coverage, samples...).
  add column velocity_signature jsonb,
  add column velocity_signature_at timestamptz,
  -- 1 = personale, 2 = archetipo, null = non ancora calibrato.
  add column signature_level integer
    check (signature_level is null or signature_level in (1, 2));
