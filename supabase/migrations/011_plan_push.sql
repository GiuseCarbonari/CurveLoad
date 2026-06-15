-- ============================================================================
-- Coach IA Endurance - Migration 011: push piano su Intervals.icu (M8)
-- ============================================================================

alter table public.weekly_plans
  add column pushed_at timestamptz,
  add column intervals_event_uids text[],
  add column last_push_status text;

comment on column public.weekly_plans.pushed_at is
  'Timestamp dell''ultimo bulk push completato su Intervals.icu.';
comment on column public.weekly_plans.intervals_event_uids is
  'UID stabili degli eventi inviati, usati per upsert anti-duplicato.';
comment on column public.weekly_plans.last_push_status is
  'Esito dell''ultimo tentativo: success oppure failed.';
