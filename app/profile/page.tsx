import { redirect } from "next/navigation";

import { CurveLoadShell } from "@/components/layout/curveload-shell";
import { DurabilityCard } from "@/components/profile/durability-card";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import type { AthleteProfileData } from "@/lib/profile/build-profile";
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
      .select("profile_data, updated_at, ai_comment_profilo, ai_comment_profilo_at")
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
  const cpw = profile?.cp_wprime ?? null;
  // Chiave propria (mai esposta) OPPURE fallback del server (Passo 2 — BYOK).
  const aiEnabled = userRow?.groq_key_encrypted != null || !!process.env.GROQ_API_KEY;

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
      />

      <div className="pt-4">
        <DurabilityCard durability={profile?.durability ?? null} />
      </div>
    </CurveLoadShell>
  );
}
