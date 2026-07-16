import { redirect } from "next/navigation";

import type { SavedGapAnalysis } from "@/components/profile/route-card-stack";
import { RouteCardStack } from "@/components/profile/route-card-stack";
import { CurveLoadShell } from "@/components/layout/curveload-shell";
import type { AthleteProfileData } from "@/lib/profile/build-profile";
import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import type { RaceEstimateV2 } from "@/lib/terrain/race-estimator-v2";
import { sanitizeRouteSettings } from "@/lib/terrain/route-settings";
import { createClient } from "@/lib/supabase/server";

export default async function TerrainPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("athlete_profiles")
    .select(
      "gap_analysis, gap_analysis_at, event_terrain, race_estimate, race_estimate_at, signature_level, profile_data"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const gapAnalysis = (row?.gap_analysis ?? null) as SavedGapAnalysis | null;
  const eventTerrain = (row?.event_terrain ?? null) as TerrainSummary | null;
  const sl = row?.signature_level;
  const signatureLevel: 1 | 2 | null = sl === 1 || sl === 2 ? sl : null;
  const raceEstimate = (row?.race_estimate ?? null) as RaceEstimateV2 | null;
  const profileData = (row?.profile_data ?? null) as AthleteProfileData | null;
  const routeSettings = sanitizeRouteSettings(profileData?.route_settings);

  return (
    <CurveLoadShell>
      <RouteCardStack
        terrain={eventTerrain}
        analysis={gapAnalysis}
        gapGeneratedAt={(row?.gap_analysis_at ?? null) as string | null}
        estimate={raceEstimate}
        estimateGeneratedAt={(row?.race_estimate_at ?? null) as string | null}
        signatureLevel={signatureLevel}
        routeSettings={routeSettings}
      />
    </CurveLoadShell>
  );
}
