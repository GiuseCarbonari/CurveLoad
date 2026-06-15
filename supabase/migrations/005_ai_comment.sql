-- ============================================================================
-- Coach IA Endurance — Migration 005: commento AI della scheda atleta (M3 passo 3)
--
-- Il commento AI (sezione 3 di docs/scheda_atleta_tooltip_e_commento.md) viene
-- generato da Claude a partire dai valori GIÀ calcolati in profile_data e
-- salvato qui, così non si rigenera ad ogni visita (bottone "rigenera" per
-- forzare). Colonne separate, non dentro profile_data: il commento è un
-- artefatto AI, distinto dai dati letti da Intervals (regola ferma: nessun
-- numero inventato finisce nel profilo).
-- ============================================================================

alter table public.athlete_profiles
  add column ai_comment text,
  add column ai_comment_at timestamptz;
