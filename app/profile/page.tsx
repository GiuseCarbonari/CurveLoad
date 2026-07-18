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

  const { data: row } = await supabase
    .from("athlete_profiles")
    .select("profile_data, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = (row?.profile_data ?? null) as AthleteProfileData | null;
  const cpw = profile?.cp_wprime ?? null;

  return (
    <CurveLoadShell>
      <ProfileTabs
        profile={profile}
        cpw={cpw}
        row={row}
      />

      <div className="pt-4">
        <DurabilityCard durability={profile?.durability ?? null} />
      </div>
    </CurveLoadShell>
  );
}
