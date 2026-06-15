-- ============================================================================
-- Coach IA Endurance — Migration 003: snapshot a mirror unico (Milestone 2)
--
-- Il sync di Milestone 2 costruisce un unico oggetto mirror_data
-- { fetched_at, athlete_profile, wellness_30d, activities_90d,
--   readiness_today, data_quality_warning } a partire dagli endpoint
-- Intervals verificati (docs/INTERVALS_API_NOTES.md).
--
-- latest_json/history_json dello schema 001 presupponevano i file separati
-- di sync.py: si unificano in una sola colonna. La separazione potrà
-- tornare quando integreremo il mirror Section 11 completo.
-- ============================================================================

alter table public.athlete_metrics_snapshots
  rename column latest_json to mirror_data;

alter table public.athlete_metrics_snapshots
  drop column history_json;
