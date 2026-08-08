import { redirect } from "next/navigation";

import { CurveLoadShell } from "@/components/layout/curveload-shell";
import { SettingsDossierForm } from "@/components/settings/dossier-form";
import { MoreSettingsRows } from "@/components/settings/more-settings-rows";
import type { CoachMemoryItem } from "@/components/settings/coach-memory-list";
import type { RaceResultItem } from "@/components/settings/race-results-form";
import {
  DOSSIER_COLUMNS,
  rowToForm,
  type DossierRow,
  type InjuryPeriod,
} from "@/lib/onboarding/dossier";
import type { MirrorData } from "@/lib/intervals/sync";
import { recoveryInputsFromPreferences } from "@/lib/recovery/baselines";
import { resolveSportModule } from "@/lib/planner/session-selector";
import { createClient } from "@/lib/supabase/server";

/**
 * /settings/profile — modifica del dossier atleta (PRD §12) in qualsiasi
 * momento. Carica la riga e la passa pre-compilata al form client.
 *
 * Tutte le voci (dossier + recupero + gare + taccuino + testo del coach +
 * chiave Groq) vivono in UNA sola lista ad accordion (SettingsDossierForm +
 * MoreSettingsRows come children) invece di card di vetro separate: su
 * richiesta diretta di Giuseppe dopo aver visto la pagina crescere ad ogni
 * rifinitura successiva.
 */
export default async function SettingsProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login"); // difesa in profondità oltre il middleware
  }

  const { data: row } = await supabase
    .from("athlete_profiles")
    .select(DOSSIER_COLUMNS.join(", "))
    .eq("user_id", user.id)
    .maybeSingle<DossierRow & { injury_periods?: InjuryPeriod[] }>();

  const initialInjuryPeriods: InjuryPeriod[] = row?.injury_periods ?? [];

  const { data: preferencesRow } = await supabase
    .from("athlete_profiles")
    .select("preferences, filosofia_coaching, filosofia_risposte")
    .eq("user_id", user.id)
    .maybeSingle<{
      preferences: unknown;
      filosofia_coaching: string | null;
      filosofia_risposte: unknown;
    }>();

  // Le soglie attive si leggono dallo stesso snapshot che le usa in
  // dashboard: unica fonte, nessun ricalcolo che potrebbe divergere.
  const { data: snapshot } = await supabase
    .from("athlete_metrics_snapshots")
    .select("mirror_data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ mirror_data: MirrorData | null }>();
  const appliedThresholds =
    snapshot?.mirror_data?.readiness_today?.calibrationApplied ?? [];

  const { data: userRow } = await supabase
    .from("users")
    .select("groq_key_encrypted")
    .eq("id", user.id)
    .maybeSingle<{ groq_key_encrypted: string | null }>();

  // Stessa regola della dashboard: chiave propria oppure fallback del server.
  const aiEnabled =
    userRow?.groq_key_encrypted != null || !!process.env.GROQ_API_KEY;

  // Il taccuino del coach: RLS select-own, quindi il client utente basta.
  const { data: memories } = await supabase
    .from("athlete_memory")
    .select("id, memory_type, nota, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<CoachMemoryItem[]>();

  // Le gare passate servono solo alla previsione Riegel, corsa-only.
  const isRunner =
    resolveSportModule(row?.sport_principali as string[] | null | undefined) === "run";
  const { data: raceResults } = isRunner
    ? await supabase
        .from("race_results")
        .select("id, nome, data, distanza_km, tempo_finale_s, livello_preparazione")
        .eq("user_id", user.id)
        .order("data", { ascending: false })
        .returns<RaceResultItem[]>()
    : { data: null };

  return (
    <CurveLoadShell>
      <SettingsDossierForm initialForm={rowToForm(row)} initialInjuryPeriods={initialInjuryPeriods}>
        <MoreSettingsRows
          recoveryInitial={recoveryInputsFromPreferences(preferencesRow?.preferences)}
          recoveryApplied={appliedThresholds}
          isRunner={isRunner}
          raceResults={raceResults ?? []}
          memories={memories ?? []}
          aiEnabled={aiEnabled}
          hasPhilosophy={preferencesRow?.filosofia_coaching != null}
          missingPhilosophyAnswers={preferencesRow?.filosofia_risposte == null}
          hasGroqKey={userRow?.groq_key_encrypted != null}
        />
      </SettingsDossierForm>
    </CurveLoadShell>
  );
}
