-- Rimuove la colonna del profilo corsa: l'app è ora solo ciclismo.
-- Additiva/reversibile a mano. Applicare quando si vuole: il codice non la usa più.
alter table public.athlete_profiles
  drop column if exists runner_profile_data;
