import { NextResponse } from "next/server";

import type { AthleteProfileData } from "@/lib/profile/build-profile";
import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import { computeRaceEstimateV2 } from "@/lib/terrain/race-estimator-v2";
import { routeSettingsToOpts, sanitizeRouteSettings } from "@/lib/terrain/route-settings";
import type { VelocitySignature } from "@/lib/terrain/velocity-signature";
import type { MirrorData } from "@/lib/intervals/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/profile/route-settings — salva peso bici/posizione/CdA/fondo
 * salite/margine di ripetibilità (Race Planner M1) e, se possibile,
 * ricalcola la stima gara con i nuovi parametri. Stesso thin pattern di
 * /api/profile/race-estimate.
 */

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "unauthorized", message: "Non autenticato" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { settings?: unknown };
  const settings = sanitizeRouteSettings(body.settings);

  const { data: row } = await supabase
    .from("athlete_profiles")
    .select("profile_data, event_terrain, velocity_signature")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = (row?.profile_data ?? null) as AthleteProfileData | null;
  const terrain = (row?.event_terrain ?? null) as TerrainSummary | null;
  const signature = (row?.velocity_signature ?? null) as VelocitySignature | null;

  if (!profile) {
    return NextResponse.json(
      {
        success: false,
        error: "no_profile",
        message: "Costruisci prima la scheda atleta (Aggiorna profilo)",
      },
      { status: 409 }
    );
  }

  // Merge JSONB sicuro: profile_data è un unico blob, si scrive per intero
  // (un update parziale sulla chiave route_settings perderebbe il resto).
  const nextProfileData: AthleteProfileData = { ...profile, route_settings: settings };

  // Ricalcola race_estimate solo se ci sono già signature + CP + peso + terrain
  // (stesso vincolo delle altre route che chiamano computeRaceEstimateV2).
  let raceEstimate = null;
  const generatedAt = new Date().toISOString();
  if (terrain && signature && profile.cp_wprime?.cp_w && profile.weight_kg != null) {
    // CTL corrente (proxy di fatica) dall'ultimo snapshot, come le altre route.
    const { data: snapshot } = await supabase
      .from("athlete_metrics_snapshots")
      .select("mirror_data")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const mirror = (snapshot?.mirror_data ?? null) as MirrorData | null;
    const ctlToday = mirror?.wellness_30d.at(-1)?.ctl ?? null;

    raceEstimate = computeRaceEstimateV2(
      terrain,
      signature,
      profile.cp_wprime.cp_w,
      profile.weight_kg,
      ctlToday,
      routeSettingsToOpts(settings, terrain.climbs)
    );
  }

  const update: Record<string, unknown> = { profile_data: nextProfileData };
  if (raceEstimate) {
    update.race_estimate = raceEstimate;
    update.race_estimate_at = generatedAt;
  }

  const { error: saveError } = await supabase
    .from("athlete_profiles")
    .update(update)
    .eq("user_id", user.id);
  if (saveError) {
    console.error("Salvataggio impostazioni percorso fallito:", saveError.message);
    return NextResponse.json(
      { success: false, error: "save_failed", message: "Salvataggio fallito, riprova" },
      { status: 500 }
    );
  }

  await createAdminClient().from("audit_logs").insert({
    user_id: user.id,
    action: "profile.route_settings",
    source: "route_settings",
    payload: {
      bike_weight_kg: settings.bike_weight_kg,
      riding_position: settings.riding_position,
      cda_m2: settings.cda_m2,
      repeatability_frac: settings.repeatability_frac,
      climbs_with_surface: Object.keys(settings.climb_surfaces).length,
      race_estimate_updated: raceEstimate != null,
    },
  });

  return NextResponse.json({
    success: true,
    race_estimate: raceEstimate,
    generated_at: raceEstimate ? generatedAt : null,
  });
}
