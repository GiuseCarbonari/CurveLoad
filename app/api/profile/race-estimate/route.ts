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
 * POST /api/profile/race-estimate — stima tempi/pacing gara (PRD §33).
 *
 * Legge event_terrain + profile_data + velocity_signature (e il CTL
 * dall'ultimo snapshot) già in athlete_profiles e calcola i tre scenari con
 * computeRaceEstimateV2() (migrata da v1: v2 usa la firma di velocità
 * personale/archetipo ed è coerente con gap-analysis/calibrate). NON chiama
 * Intervals, NON chiama AI: solo modello fisico deterministico.
 */

/** Numero minimo di punti polyline per una stima sensata. */
const MIN_POLYLINE_POINTS = 10;

export async function POST() {
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

  const { data: row } = await supabase
    .from("athlete_profiles")
    .select("profile_data, event_terrain, velocity_signature")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = (row?.profile_data ?? null) as AthleteProfileData | null;
  const terrain = (row?.event_terrain ?? null) as TerrainSummary | null;
  const signature = (row?.velocity_signature ?? null) as VelocitySignature | null;

  if (!terrain) {
    return NextResponse.json(
      {
        success: false,
        error: "no_terrain",
        message: "Analizza prima un evento (serve il percorso) dalla sezione «Analisi evento»",
      },
      { status: 400 }
    );
  }
  if (!profile?.cp_wprime?.cp_w || profile.weight_kg == null) {
    return NextResponse.json(
      {
        success: false,
        error: "no_profile_inputs",
        message: "Servono CP e peso: costruisci/aggiorna la scheda atleta",
      },
      { status: 400 }
    );
  }
  if (!terrain.polyline || terrain.polyline.length < MIN_POLYLINE_POINTS) {
    return NextResponse.json(
      {
        success: false,
        error: "insufficient_track",
        message: "Traccia GPX insufficiente per la stima",
      },
      { status: 400 }
    );
  }
  if (!signature) {
    return NextResponse.json(
      {
        success: false,
        error: "no_signature",
        message: "Calibra prima la firma di velocità dalla sezione «Stima gara»",
      },
      { status: 400 }
    );
  }

  // CTL corrente (proxy di fatica) dall'ultimo snapshot.
  const { data: snapshot } = await supabase
    .from("athlete_metrics_snapshots")
    .select("mirror_data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const mirror = (snapshot?.mirror_data ?? null) as MirrorData | null;
  const ctlToday = mirror?.wellness_30d.at(-1)?.ctl ?? null;

  const routeSettings = sanitizeRouteSettings(profile.route_settings);
  const estimate = computeRaceEstimateV2(
    terrain,
    signature,
    profile.cp_wprime.cp_w,
    profile.weight_kg,
    ctlToday,
    routeSettingsToOpts(routeSettings, terrain.climbs)
  );

  const generatedAt = new Date().toISOString();
  const { error: saveError } = await supabase
    .from("athlete_profiles")
    .update({ race_estimate: estimate, race_estimate_at: generatedAt })
    .eq("user_id", user.id);
  if (saveError) {
    console.error("Salvataggio stima gara fallito:", saveError.message);
  }

  await createAdminClient().from("audit_logs").insert({
    user_id: user.id,
    action: "profile.race_estimate",
    source: "race_estimate",
    payload: {
      realistic_s: estimate.scenarios.realistic.total_seconds,
      cp_w: estimate.cp_w,
      weight_kg: estimate.weight_kg,
      saved: !saveError,
    },
  });

  return NextResponse.json({
    success: true,
    race_estimate: estimate,
    generated_at: generatedAt,
  });
}
