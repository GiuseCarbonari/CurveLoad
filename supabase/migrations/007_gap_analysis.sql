-- ============================================================================
-- Coach IA Endurance — Migration 007: gap analysis evento target (M5, PRD §33 C.6)
--
-- Il motore di gap analysis (lib/terrain) legge il GPX della gara target,
-- rileva le salite (replica soglie Section 11) e confronta la domanda
-- dell'evento col fenotipo dell'atleta. I risultati si salvano qui così non
-- si riscarica/rianalizza il percorso ad ogni visita (bottone "Analizza
-- evento" per (ri)generare).
--
-- JSONB perché lo schema del terrain_summary e dei limitatori evolverà
-- (allineato a routes.json di Section 11) senza richiedere migration.
-- ============================================================================

alter table public.athlete_profiles
  -- Lista ordinata di limitatori vs evento (computeGapAnalysis).
  add column gap_analysis jsonb,
  add column gap_analysis_at timestamptz,
  -- terrain_summary grezzo (detectClimbs): altimetria, climbs[], polyline.
  add column event_terrain jsonb;
