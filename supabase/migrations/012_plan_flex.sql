-- ============================================================================
-- Coach IA Endurance - Migration 012: piano flessibile / ridistribuzione (M9)
-- ============================================================================

alter table public.weekly_plans
  add column plan_history jsonb,
  add column last_redistributed_at timestamptz;

comment on column public.weekly_plans.plan_history is
  'Versioni precedenti del piano (array di oggetti {sessions, generated_at, reason}).';
comment on column public.weekly_plans.last_redistributed_at is
  'Timestamp dell''ultima ridistribuzione richiesta dall''utente.';
