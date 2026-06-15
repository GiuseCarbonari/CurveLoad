/**
 * Calibrazione firma di velocità (M7) — logica condivisa tra la route
 * POST /api/profile/calibrate (manuale) e il trigger automatico nel sync.
 *
 * NON è una funzione pura: legge token/attività da Intervals e scrive su DB
 * (service role). La parte di CALCOLO resta pura in velocity-signature.ts e
 * race-estimator-v2.ts; qui si orchestrano I/O e persistenza.
 */

import { decryptToken } from "@/lib/crypto";
import { IntervalsApiError, IntervalsFetcher } from "@/lib/intervals-client";
import type { MirrorData } from "@/lib/intervals/sync";
import type { AthleteProfileData } from "@/lib/profile/build-profile";
import { computeRaceEstimateV2 } from "@/lib/terrain/race-estimator-v2";
import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import {
  buildAthleteSignature,
  type ActivityMeta,
} from "@/lib/terrain/velocity-signature";
import { createAdminClient } from "@/lib/supabase/admin";

/** Quante attività indietro guardare per la calibrazione. */
const LOOKBACK_DAYS = 180;
/** Soglia di attività MTB per il trigger AUTOMATICO nel sync. */
const AUTO_MIN_MTB = 5;

export type CalibrateResult =
  | {
      ok: true;
      signature_level: 1 | 2;
      coverage_pct: number;
      activities_used: number;
      race_estimate_updated: boolean;
    }
  | { ok: false; reason: "not_connected" | "intervals_unauthorized" | "api_error" | "internal_error" };

/** Data locale YYYY-MM-DD con offset di giorni. */
function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA");
}

/**
 * Costruisce la firma personale dalle ultime attività MTB dell'utente, la
 * salva in athlete_profiles e aggiorna la stima tempi (race-estimator-v2) se
 * c'è un percorso evento analizzato + CP + peso.
 */
export async function calibrateAthlete(userId: string): Promise<CalibrateResult> {
  const admin = createAdminClient();

  // Token Intervals (service role: la scrittura/lettura calibrazione è backend).
  const { data: connection } = await admin
    .from("intervals_connections")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (!connection) return { ok: false, reason: "not_connected" };

  const fetcher = new IntervalsFetcher(decryptToken(connection.access_token_encrypted));

  // Lista attività (campi ridotti già nel client) degli ultimi ~6 mesi.
  let activities: ActivityMeta[];
  try {
    const list = await fetcher.getActivities(localDate(-LOOKBACK_DAYS));
    activities = list.map((a) => ({
      id: a.id,
      type: a.type,
      moving_time: a.moving_time,
      distance: a.distance,
    }));
  } catch (error) {
    if (error instanceof IntervalsApiError && error.status === 401) {
      await admin.from("intervals_connections").delete().eq("user_id", userId);
      return { ok: false, reason: "intervals_unauthorized" };
    }
    return { ok: false, reason: "api_error" };
  }

  // Costruisce la firma: scarica gli stream (solo altitude+velocity) per ogni MTB.
  const signature = await buildAthleteSignature(userId, activities, (id) =>
    fetcher.getActivityStreams(id, "altitude,velocity_smooth")
  );

  const signatureAt = new Date().toISOString();

  // Profilo + ultimo CTL: servono a ricalcolare la stima tempi (se possibile).
  const { data: profileRow } = await admin
    .from("athlete_profiles")
    .select("profile_data, event_terrain")
    .eq("user_id", userId)
    .maybeSingle();
  const profile = (profileRow?.profile_data ?? null) as AthleteProfileData | null;
  const terrain = (profileRow?.event_terrain ?? null) as TerrainSummary | null;

  const { data: snapshot } = await admin
    .from("athlete_metrics_snapshots")
    .select("mirror_data")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const mirror = (snapshot?.mirror_data ?? null) as MirrorData | null;
  const ctlToday = mirror?.wellness_30d.at(-1)?.ctl ?? null;

  const update: Record<string, unknown> = {
    velocity_signature: signature,
    velocity_signature_at: signatureAt,
    signature_level: signature.level,
  };

  // Riattiva la stima tempi v2 con la firma appena costruita.
  let raceEstimateUpdated = false;
  if (terrain && profile?.cp_wprime?.cp_w && profile.weight_kg != null) {
    const estimate = computeRaceEstimateV2(
      terrain,
      signature,
      profile.cp_wprime.cp_w,
      profile.weight_kg,
      ctlToday
    );
    update.race_estimate = estimate;
    update.race_estimate_at = signatureAt;
    raceEstimateUpdated = true;
  }

  const { error: saveError } = await admin
    .from("athlete_profiles")
    .update(update)
    .eq("user_id", userId);
  if (saveError) {
    console.error("Salvataggio firma velocità fallito:", saveError.message);
    return { ok: false, reason: "internal_error" };
  }

  await admin.from("audit_logs").insert({
    user_id: userId,
    action: "profile.calibrate",
    source: "calibrate",
    payload: {
      signature_level: signature.level,
      coverage_pct: signature.coverage_pct,
      activities_used: signature.activities_used,
      total_samples: signature.total_samples,
      race_estimate_updated: raceEstimateUpdated,
    },
  });

  return {
    ok: true,
    signature_level: signature.level,
    coverage_pct: signature.coverage_pct,
    activities_used: signature.activities_used,
    race_estimate_updated: raceEstimateUpdated,
  };
}

/**
 * Trigger automatico (fire-and-forget dal sync): calibra solo se la firma non
 * esiste ancora e l'atleta ha già abbastanza uscite MTB. Non lancia: logga e
 * basta, per non disturbare il sync.
 */
export async function autoCalibrateIfNeeded(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("athlete_profiles")
      .select("signature_level")
      .eq("user_id", userId)
      .maybeSingle();
    if (row?.signature_level != null) return; // già calibrato

    // Conta le MTB recenti dall'ultimo snapshot (niente chiamata extra).
    const { data: snapshot } = await admin
      .from("athlete_metrics_snapshots")
      .select("mirror_data")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const mirror = (snapshot?.mirror_data ?? null) as MirrorData | null;
    const mtbCount = (mirror?.activities_90d ?? []).filter(
      (a) => a.type === "MountainBikeRide"
    ).length;
    if (mtbCount <= AUTO_MIN_MTB) return;

    await calibrateAthlete(userId);
  } catch (error) {
    console.error("Auto-calibrazione fallita (non bloccante):", error);
  }
}
