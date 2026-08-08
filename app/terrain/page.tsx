import { redirect } from "next/navigation";

import type { SavedGapAnalysis } from "@/components/profile/route-card-stack";
import { RouteCardStack } from "@/components/profile/route-card-stack";
import { CurveLoadShell } from "@/components/layout/curveload-shell";
import { resolveSportModule } from "@/lib/planner/session-selector";
import type { AthleteProfileData } from "@/lib/profile/build-profile";
import type { RunnerProfileData } from "@/lib/profile/pace-profile";
import type { RaceResult } from "@/lib/profile/riegel";
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

  const [{ data: row }, { data: userRow }] = await Promise.all([
    supabase
      .from("athlete_profiles")
      .select(
        "gap_analysis, gap_analysis_at, event_terrain, race_estimate, race_estimate_at, signature_level, profile_data, ai_comment_percorso, ai_comment_percorso_at, sport_principali, runner_profile_data"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("users")
      .select("groq_key_encrypted")
      .eq("id", user.id)
      .maybeSingle<{ groq_key_encrypted: string | null }>(),
  ]);

  const gapAnalysis = (row?.gap_analysis ?? null) as SavedGapAnalysis | null;
  const eventTerrain = (row?.event_terrain ?? null) as TerrainSummary | null;
  const sl = row?.signature_level;
  const signatureLevel: 1 | 2 | null = sl === 1 || sl === 2 ? sl : null;
  const raceEstimate = (row?.race_estimate ?? null) as RaceEstimateV2 | null;
  const profileData = (row?.profile_data ?? null) as AthleteProfileData | null;
  const routeSettings = sanitizeRouteSettings(profileData?.route_settings);
  const isRunner = resolveSportModule(row?.sport_principali) === "run";
  const runnerProfile = (row?.runner_profile_data ?? null) as RunnerProfileData | null;
  // Chiave propria (mai esposta) OPPURE fallback del server (Passo 2 — BYOK).
  const aiEnabled = userRow?.groq_key_encrypted != null || !!process.env.GROQ_API_KEY;

  // Risultati di gara passati (per Riegel), solo per chi corre.
  const { data: raceResults } = isRunner
    ? await supabase
        .from("race_results")
        .select("data, distanza_km, tempo_finale_s, livello_preparazione")
        .eq("user_id", user.id)
        .order("data", { ascending: false })
        .returns<RaceResult[]>()
    : { data: null };

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
        aiEnabled={aiEnabled}
        aiComment={(row?.ai_comment_percorso ?? null) as string | null}
        aiCommentAt={(row?.ai_comment_percorso_at ?? null) as string | null}
        isRunner={isRunner}
        runnerProfile={runnerProfile}
        raceResults={raceResults ?? []}
      />
    </CurveLoadShell>
  );
}
