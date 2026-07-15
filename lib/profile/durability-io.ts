/**
 * Orchestratore I/O della durabilità — COPIA la struttura di
 * lib/terrain/calibrate.ts (token → lista attività → scarica stream per
 * ognuna → calcolo puro → update athlete_profiles → audit_logs).
 *
 * NON è una funzione pura: legge token/attività da Intervals e scrive su DB
 * (service role). Il calcolo resta puro in durability.ts.
 */

import { decryptToken } from "@/lib/crypto";
import { IntervalsApiError, IntervalsFetcher } from "@/lib/intervals-client";
import type { AthleteProfileData } from "@/lib/profile/build-profile";
import {
  buildDurability,
  LOOKBACK_DAYS,
  MAX_ACTIVITIES,
  MIN_ACTIVITIES,
  MIN_LONG_RIDE_SECS,
  type WattsStream,
} from "@/lib/profile/durability";
import { createAdminClient } from "@/lib/supabase/admin";

/** Tipi ciclismo candidati (esclude corsa/nuoto/altro). */
const CYCLING_TYPES = new Set(["Ride", "VirtualRide", "MountainBikeRide", "GravelRide"]);

export type DurabilityOutcome =
  | {
      ok: true;
      durability_index: number | null;
      activities_used: number;
      confidence: "high" | "medium" | "low";
    }
  | {
      ok: false;
      reason: "not_connected" | "intervals_unauthorized" | "api_error" | "internal_error" | "insufficient_data";
    };

/** Data locale YYYY-MM-DD con offset di giorni. */
function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA");
}

/** Uno stream watts è usabile se ha almeno un campione di potenza > 0. */
function isUsableStream(watts: Array<number | null>): boolean {
  return watts.some((w) => w != null && w > 0);
}

/**
 * Costruisce la curva di durabilità dalle ultime uscite lunghe dell'atleta,
 * la salva in athlete_profiles.profile_data.durability (merge non distruttivo).
 */
export async function buildAthleteDurability(userId: string): Promise<DurabilityOutcome> {
  const admin = createAdminClient();

  const { data: connection } = await admin
    .from("intervals_connections")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (!connection) return { ok: false, reason: "not_connected" };

  const fetcher = new IntervalsFetcher(decryptToken(connection.access_token_encrypted));

  let candidates: Array<{ id: string | number }>;
  try {
    const activities = await fetcher.getActivities(localDate(-LOOKBACK_DAYS));
    candidates = activities
      .filter(
        (a) =>
          a.type != null &&
          CYCLING_TYPES.has(a.type) &&
          (a.moving_time ?? 0) >= MIN_LONG_RIDE_SECS &&
          a.icu_weighted_avg_watts != null
      )
      // Più recenti prima (start_date_local è ISO, l'ordine lessicale coincide).
      .sort((a, b) => (a.start_date_local < b.start_date_local ? 1 : -1))
      .slice(0, MAX_ACTIVITIES)
      .map((a) => ({ id: a.id }));
  } catch (error) {
    if (error instanceof IntervalsApiError && error.status === 401) {
      await admin.from("intervals_connections").delete().eq("user_id", userId);
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "intervals.token_invalid",
        source: "durability",
        payload: {},
      });
      return { ok: false, reason: "intervals_unauthorized" };
    }
    return { ok: false, reason: "api_error" };
  }

  // Scarica gli stream watts, best-effort: un fallimento singolo non blocca il resto.
  const streams: WattsStream[] = [];
  for (const candidate of candidates) {
    try {
      const activityStreams = await fetcher.getActivityStreams(String(candidate.id), "watts");
      const wattsStream = activityStreams.find((s) => s.type === "watts");
      if (wattsStream && isUsableStream(wattsStream.data)) {
        streams.push({ activity_id: candidate.id, watts: wattsStream.data });
      }
    } catch {
      // Stream 404/vuoto: si salta l'attività, non fa fallire tutto.
    }
  }

  if (streams.length < MIN_ACTIVITIES) {
    return { ok: false, reason: "insufficient_data" };
  }

  const durability = buildDurability(streams);
  const builtAt = new Date().toISOString();

  const { data: profileRow } = await admin
    .from("athlete_profiles")
    .select("profile_data")
    .eq("user_id", userId)
    .maybeSingle();
  const profile = (profileRow?.profile_data ?? null) as AthleteProfileData | null;

  const { error: saveError } = await admin
    .from("athlete_profiles")
    .update({
      profile_data: {
        ...(profile ?? {}),
        durability: { ...durability, built_at: builtAt },
      },
    })
    .eq("user_id", userId);
  if (saveError) {
    console.error("Salvataggio durabilità fallito:", saveError.message);
    return { ok: false, reason: "internal_error" };
  }

  await admin.from("audit_logs").insert({
    user_id: userId,
    action: "profile.durability",
    source: "durability",
    payload: {
      durability_index: durability.durability_index,
      activities_used: durability.meta.activities_used,
      confidence: durability.confidence,
    },
  });

  return {
    ok: true,
    durability_index: durability.durability_index,
    activities_used: durability.meta.activities_used,
    confidence: durability.confidence,
  };
}
