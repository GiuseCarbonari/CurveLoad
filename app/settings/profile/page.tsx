import { redirect } from "next/navigation";

import { CurveLoadShell } from "@/components/layout/curveload-shell";
import { SettingsDossierForm } from "@/components/settings/dossier-form";
import { PhilosophyButton } from "@/components/profile/philosophy-button";
import {
  CoachMemoryList,
  type CoachMemoryItem,
} from "@/components/settings/coach-memory-list";
import { GroqKeyForm } from "@/components/settings/groq-key-form";
import { RecoveryForm } from "@/components/settings/recovery-form";
import {
  DOSSIER_COLUMNS,
  rowToForm,
  type DossierRow,
  type InjuryPeriod,
} from "@/lib/onboarding/dossier";
import type { MirrorData } from "@/lib/intervals/sync";
import { recoveryInputsFromPreferences } from "@/lib/recovery/baselines";
import { createClient } from "@/lib/supabase/server";

/**
 * /settings/profile — modifica del dossier atleta (PRD §12) in qualsiasi
 * momento. Carica la riga e la passa pre-compilata al form client.
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

  return (
    <CurveLoadShell>
      <SettingsDossierForm initialForm={rowToForm(row)} initialInjuryPeriods={initialInjuryPeriods} />
      <RecoveryForm
        initial={recoveryInputsFromPreferences(preferencesRow?.preferences)}
        applied={appliedThresholds}
      />
      <CoachMemoryList items={memories ?? []} />

      {/* Il bottone vive anche in /profile, ma le risposte che rendono la
          filosofia obsoleta si cambiano QUI: senza questo, uno modifica il
          dossier e non ha modo di sapere che il testo è rimasto quello di
          prima. Stesso componente, non una seconda implementazione. */}
      <div
        className="mt-4 rounded-metric px-4 py-4"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
          La tua filosofia
        </div>
        <p className="mb-3 mt-1.5 text-[13px] text-secondary">
          È stata scritta una volta sui dati di allora e non si aggiorna da
          sola. Se hai cambiato le risposte qui sopra — o se racconta cose che
          non valgono più — riscrivila.
        </p>
        <PhilosophyButton
          enabled={aiEnabled && preferencesRow?.filosofia_risposte != null}
          hasPhilosophy={preferencesRow?.filosofia_coaching != null}
          missingAnswers={preferencesRow?.filosofia_risposte == null}
        />
      </div>

      <GroqKeyForm hasKey={userRow?.groq_key_encrypted != null} />
    </CurveLoadShell>
  );
}
