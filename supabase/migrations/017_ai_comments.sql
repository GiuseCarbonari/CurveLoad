-- Migration 017: Add AI comment columns for three sections (OGGI, PROFILO, PERCORSO)
ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS ai_comment_oggi text,
  ADD COLUMN IF NOT EXISTS ai_comment_oggi_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_comment_profilo text,
  ADD COLUMN IF NOT EXISTS ai_comment_profilo_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_comment_percorso text,
  ADD COLUMN IF NOT EXISTS ai_comment_percorso_at timestamptz;

COMMENT ON COLUMN public.athlete_profiles.ai_comment_oggi IS
  'AI comment for OGGI section: readiness, how to approach session, metrics, trends';
COMMENT ON COLUMN public.athlete_profiles.ai_comment_profilo IS
  'AI comment for PROFILO section: phenotype, 14-day variation trends';
COMMENT ON COLUMN public.athlete_profiles.ai_comment_percorso IS
  'AI comment for ANALISI PERCORSO section: altimetry analysis, nutrition strategy, pacing, recovery';
