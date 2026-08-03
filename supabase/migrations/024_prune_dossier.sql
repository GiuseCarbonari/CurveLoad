-- Revisione onboarding (docs/PIANO.md) — rimuove le colonne dossier senza
-- alcun consumer verificato: nessun motore (planner, profilo, readiness,
-- context AI) le legge mai. I numeri equivalenti arrivano da Intervals.icu
-- (peso, FTP, zone), che è già obbligatorio prima dell'onboarding.
--
-- ftp_outdoor_w era l'unico degli otto campi "Parametri fisiologici" con un
-- consumer (fallback FTP in /api/profile/build): il fallback ora legge
-- icu_ftp/threshold_power dal profilo Intervals, quindi anche questa colonna
-- non serve più.
--
-- Da lanciare nel SQL Editor Supabase SOLO dopo il deploy del codice che non
-- nomina più queste colonne (lib/onboarding/dossier.ts, DOSSIER_COLUMNS):
-- prima del deploy il `select` del wizard fallirebbe.
alter table public.athlete_profiles
  drop column if exists altezza_cm,
  drop column if exists peso_dichiarato_kg,
  drop column if exists peso_target_kg,
  drop column if exists fase_corrente,
  drop column if exists ftp_outdoor_w,
  drop column if exists ftp_indoor_w,
  drop column if exists max_hr,
  drop column if exists threshold_hr,
  drop column if exists lt1_w,
  drop column if exists lt1_hr,
  drop column if exists lt2_w,
  drop column if exists lt2_hr,
  drop column if exists ciclocomputer,
  drop column if exists ha_misuratore_potenza,
  drop column if exists ha_fascia_cardio,
  drop column if exists ha_smartwatch,
  drop column if exists bici_outdoor,
  drop column if exists piattaforma_indoor;
