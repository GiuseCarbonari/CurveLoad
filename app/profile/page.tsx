import { redirect } from "next/navigation";

import { CurveLoadShell } from "@/components/layout/curveload-shell";
import { DurabilityCard } from "@/components/profile/durability-card";
import { PhilosophyCard } from "@/components/profile/philosophy-card";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { RunnerCard } from "@/components/profile/runner-card";
import type { FilosofiaForm } from "@/lib/onboarding/dossier";
import { isRunningOnlyDossier } from "@/lib/planner/build-week";
import type { AthleteProfileData } from "@/lib/profile/build-profile";
import type { RunnerProfileData } from "@/lib/profile/pace-profile";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: row }, { data: userRow }, { data: memoryRows }] = await Promise.all([
    supabase
      .from("athlete_profiles")
      .select(
        "profile_data, runner_profile_data, updated_at, ai_comment_profilo, ai_comment_profilo_at, filosofia_risposte, filosofia_coaching, filosofia_coaching_at, sport_principali"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("users")
      .select("groq_key_encrypted")
      .eq("id", user.id)
      .maybeSingle<{ groq_key_encrypted: string | null }>(),
    // Taccuino del coach (Passo 5): lettura via RLS, solo le proprie note.
    supabase
      .from("athlete_memory")
      .select("id, created_at, memory_type, nota")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const profile = (row?.profile_data ?? null) as AthleteProfileData | null;
  const runner = (row?.runner_profile_data ?? null) as RunnerProfileData | null;
  const cpw = profile?.cp_wprime ?? null;
  const isRunner = isRunningOnlyDossier(row?.sport_principali);
  // Chiave propria (mai esposta) OPPURE fallback del server (Passo 2 — BYOK).
  const aiEnabled = userRow?.groq_key_encrypted != null || !!process.env.GROQ_API_KEY;
  const filosofia = (row?.filosofia_risposte ?? null) as FilosofiaForm | null;

  return (
    <CurveLoadShell>
      <ProfileTabs
        profile={profile}
        cpw={cpw}
        row={row}
        aiEnabled={aiEnabled}
        aiComment={row?.ai_comment_profilo ?? null}
        aiCommentAt={row?.ai_comment_profilo_at ?? null}
        coachNotes={memoryRows ?? []}
        isRunner={isRunner}
        hasRunnerProfile={runner != null}
      />

      <div className="pt-4">
        {isRunner ? (
          <RunnerCard runner={runner} />
        ) : (
          <>
            <DurabilityCard durability={profile?.durability ?? null} />
            <div className="pt-4">
              <RunnerCard runner={runner} />
            </div>
          </>
        )}
        <div className="pt-4">
          <PhilosophyCard
            philosophy={row?.filosofia_coaching ?? null}
            philosophyAt={row?.filosofia_coaching_at ?? null}
            scuole={filosofia?.scuole ?? []}
            hasAnswers={filosofia != null}
            aiEnabled={aiEnabled}
          />
        </div>
      </div>
    </CurveLoadShell>
  );
}
