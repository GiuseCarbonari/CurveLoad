import { decryptToken } from "@/lib/crypto";
import { IntervalsApiError, IntervalsFetcher } from "@/lib/intervals-client";
import { wellnessOf, type MirrorData } from "@/lib/intervals/sync";
import type { BuiltSession } from "@/lib/planner/build-week";
import { resolveSportModule } from "@/lib/planner/session-selector";
import { computeEfficiencyTrend } from "@/lib/efficiency-trend";
import { createAdminClient } from "@/lib/supabase/admin";
import { assembleAthleteContext } from "@/lib/ai/context";
import { GroqCallError, callLlm, DEFAULT_AI_MODEL } from "@/lib/ai/groq";
import { findUnexpectedNumbers } from "@/lib/ai/profile-explain-prompt";
import { buildReviewPrompt } from "@/lib/ai/review-prompt";
import { resolveGroqKey } from "@/lib/ai/resolve-key";
import { extractCoachNotes } from "@/lib/ai/coach-memory";
import { lastClosedWeek, type WeekWindow } from "@/lib/review/week-window";
import { summarizeActualWeek, type ActualWeekSummary } from "@/lib/review/week-actual";
import { matchPlanToActual, type SessionExecution } from "@/lib/review/execution";
import { computeDecoupling, computeTimeAboveEasyCeiling } from "@/lib/review/drift";
import { reconcileFeelVsData, type Divergence, type FeelAnswers } from "@/lib/review/feel";
import { hardSessionTrend, type HardSessionTrendPoint, type ReviewTrend } from "@/lib/review/trends";

/**
 * Orchestratore I/O della review settimanale — stesso pattern di
 * lib/profile/durability-io.ts + lib/profile/explain-io.ts: lettura DB/API →
 * motore puro (lib/review/*) → prompt → Groq → salvataggio → audit_logs.
 *
 * Gli stream 1 Hz (frequenza cardiaca + sforzo) sono l'unico dato che non
 * vive già nel mirror: si scaricano qui, uno per attività della settimana,
 * ciclo sequenziale con try/catch per attività (stesso pattern di
 * durability-io.ts — un 404/stream vuoto salta l'attività, non blocca tutto).
 */

const RIDE_TYPES = new Set(["Ride", "VirtualRide", "MountainBikeRide", "GravelRide"]);
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const MAX_STREAM_FETCHES = 10;
const MAX_PAST_REVIEWS = 8;

export type GenerateReviewOutcome =
  | { ok: true; weekStart: string }
  | {
      ok: false;
      reason:
        | "not_connected"
        | "no_snapshot"
        | "no_api_key"
        | "invalid_user_key"
        | "ai_error"
        | "internal_error";
    };

interface WeeklyPlanRow {
  week_start: string;
  phase: string;
  sessions: BuiltSession[];
  validation_metadata: {
    phase_reason?: string | null;
    mesocycle_reason?: string | null;
    is_deload?: boolean;
  } | null;
}

interface PastReviewRow {
  week_start: string;
  metrics: { hardPlanned?: number; hardCompleted?: number } | null;
}

interface StreamMetrics {
  decouplingPct: number | null;
  easyAboveCeilingFraction: number | null;
}

/** Frequenza cardiaca + sforzo (watts bici / velocity_smooth corsa) per un'attività della settimana. */
async function fetchStreamMetrics(
  fetcher: IntervalsFetcher,
  activity: { id: string | number; type: string | null },
  hrZonesBike: number[] | null,
  hrZonesRun: number[] | null,
  isPlannedEasy: boolean
): Promise<StreamMetrics | null> {
  const isBike = activity.type != null && RIDE_TYPES.has(activity.type);
  const isRun = activity.type != null && RUN_TYPES.has(activity.type);
  if (!isBike && !isRun) return null;

  const effortType = isBike ? "watts" : "velocity_smooth";
  try {
    const streams = await fetcher.getActivityStreams(
      String(activity.id),
      `heartrate,${effortType}`
    );
    const hr = streams.find((s) => s.type === "heartrate")?.data ?? null;
    const effort = streams.find((s) => s.type === effortType)?.data ?? null;
    if (hr == null || effort == null) return null;

    const decoupling = computeDecoupling(hr, effort);
    const hrZones = isBike ? hrZonesBike : hrZonesRun;
    const ceiling = isPlannedEasy ? computeTimeAboveEasyCeiling(hr, hrZones) : null;

    return {
      decouplingPct: decoupling.decouplingPct,
      easyAboveCeilingFraction: ceiling?.aboveEasyCeilingFraction ?? null,
    };
  } catch {
    return null; // stream 404/vuoto: si salta l'attività, non fa fallire la review.
  }
}

export async function generateWeeklyReview(
  userId: string,
  feel: FeelAnswers,
  week: WeekWindow = lastClosedWeek()
): Promise<GenerateReviewOutcome> {
  const admin = createAdminClient();

  const [{ data: connection }, { data: snapshot }, { data: planRow }, { data: profileRow }] =
    await Promise.all([
      admin
        .from("intervals_connections")
        .select("access_token_encrypted")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("athlete_metrics_snapshots")
        .select("mirror_data")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("weekly_plans")
        .select("week_start, phase, sessions, validation_metadata")
        .eq("user_id", userId)
        .eq("week_start", week.weekStart)
        .maybeSingle(),
      admin
        .from("athlete_profiles")
        .select("sport_principali")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  if (!connection) return { ok: false, reason: "not_connected" };
  const mirror = (snapshot?.mirror_data ?? null) as MirrorData | null;
  if (!mirror) return { ok: false, reason: "no_snapshot" };

  const plan = (planRow ?? null) as WeeklyPlanRow | null;
  const sports = (profileRow?.sport_principali ?? null) as string[] | null;
  const sportModule = resolveSportModule(sports) ?? "bike";

  // --- Reale: volume/dislivello/carico dal mirror (già sincronizzato) ------
  const actual = summarizeActualWeek(mirror.activities_90d, week);
  const execution = plan
    ? matchPlanToActual(plan.sessions, mirror.activities_90d, week)
    : matchPlanToActual([], mirror.activities_90d, week);

  // --- Stream 1 Hz: decoupling + tempo sopra soglia facile ------------------
  let fetcher: IntervalsFetcher | null = null;
  try {
    fetcher = new IntervalsFetcher(decryptToken(connection.access_token_encrypted));
  } catch {
    fetcher = null; // token non decifrabile: la review procede senza drift/decoupling.
  }

  const streamByDate = new Map<string, StreamMetrics>();
  if (fetcher) {
    const withActivity = execution.filter((e) => e.activity != null).slice(0, MAX_STREAM_FETCHES);
    for (const e of withActivity) {
      const isPlannedEasy = e.planned != null && !e.planned.is_hard;
      const metrics = await fetchStreamMetrics(
        fetcher,
        e.activity!,
        mirror.athlete_profile.hr_zones_bike?.hr_zones ?? null,
        mirror.athlete_profile.hr_zones_run?.hr_zones ?? null,
        isPlannedEasy
      );
      if (metrics) streamByDate.set(e.date, metrics);
    }
  }

  const easyFractions = execution
    .map((e) => streamByDate.get(e.date)?.easyAboveCeilingFraction ?? null)
    .filter((v): v is number => v != null);
  const avgEasyAboveCeilingFraction =
    easyFractions.length > 0
      ? Math.round((easyFractions.reduce((s, v) => s + v, 0) / easyFractions.length) * 1000) / 1000
      : null;

  const decouplingValues = Array.from(streamByDate.values())
    .map((m) => m.decouplingPct)
    .filter((v): v is number => v != null);
  const maxDecouplingPct = decouplingValues.length > 0 ? Math.max(...decouplingValues) : null;

  // --- Carico a fine settimana: CTL/ATL letti, TSB/ACWR = aritmetica semplice sui valori letti ---
  const wellnessAtWeekEnd = [...wellnessOf(mirror)]
    .filter((w) => w.date <= week.weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const ctl = wellnessAtWeekEnd?.ctl ?? null;
  const atl = wellnessAtWeekEnd?.atl ?? null;
  const tsb = ctl != null && atl != null ? Math.round((ctl - atl) * 10) / 10 : null;
  const acwr = ctl != null && atl != null && ctl !== 0 ? Math.round((atl / ctl) * 100) / 100 : null;

  const sleepValuesInWeek = wellnessOf(mirror)
    .filter((w) => w.date >= week.weekStart && w.date <= week.weekEnd && w.sleepSecs != null)
    .map((w) => (w.sleepSecs as number) / 3600);
  const sleepAvgHoursFromIntervals =
    sleepValuesInWeek.length > 0
      ? Math.round((sleepValuesInWeek.reduce((s, v) => s + v, 0) / sleepValuesInWeek.length) * 10) / 10
      : null;

  const hardPlanned = execution.filter((e) => e.planned?.is_hard === true).length;
  const hardCompleted = execution.filter(
    (e) => e.planned?.is_hard === true && e.status === "eseguita"
  ).length;
  const hardMissed = hardPlanned - hardCompleted;

  const divergences: Divergence[] = reconcileFeelVsData(feel, {
    acwr,
    tsb,
    hardSessionsPlanned: hardPlanned,
    hardSessionsMissed: hardMissed,
    avgEasyAboveCeilingFraction,
    maxDecouplingPct,
    sleepAvgHoursFromIntervals,
  });

  // --- Tendenze: ultime review + questa settimana ---------------------------
  const { data: pastReviewRows } = await admin
    .from("weekly_reviews")
    .select("week_start, metrics")
    .eq("user_id", userId)
    .neq("week_start", week.weekStart)
    .order("week_start", { ascending: false })
    .limit(MAX_PAST_REVIEWS - 1);
  const pastReviews = (pastReviewRows ?? []) as PastReviewRow[];
  const trendPoints: HardSessionTrendPoint[] = [
    ...pastReviews.map((r) => ({
      weekStart: r.week_start,
      hardPlanned: r.metrics?.hardPlanned ?? 0,
      hardCompleted: r.metrics?.hardCompleted ?? 0,
    })),
    { weekStart: week.weekStart, hardPlanned, hardCompleted },
  ];
  const trends: ReviewTrend[] = [];
  const hardTrend = hardSessionTrend(trendPoints);
  if (hardTrend) trends.push(hardTrend);

  const efficiencyTrend = computeEfficiencyTrend(mirror.activities_90d, sportModule);
  const efficiencyForPrompt =
    efficiencyTrend.interpretation === "dati insufficienti"
      ? null
      : { interpretation: efficiencyTrend.interpretation, summary: efficiencyTrend.summary };

  // --- Contesto atleta (dossier, condizione, decisioni, taccuino, voce) -----
  const context = await assembleAthleteContext(userId);

  const promptInput = {
    week,
    plan: plan
      ? {
          phase: plan.phase,
          hardPlanned,
          isDeload: plan.validation_metadata?.is_deload ?? false,
          phaseReason: plan.validation_metadata?.phase_reason ?? null,
          mesocycleReason: plan.validation_metadata?.mesocycle_reason ?? null,
        }
      : null,
    actual,
    execution,
    feel,
    divergences,
    trends,
    efficiencyTrend: efficiencyForPrompt,
    context,
  };
  const prompt = buildReviewPrompt(promptInput);

  const resolvedKey = await resolveGroqKey(userId);
  if (!resolvedKey) return { ok: false, reason: "no_api_key" };

  let rawText: string;
  try {
    rawText = await callLlm({
      apiKey: resolvedKey.apiKey,
      system: prompt.system,
      userMessage: prompt.user,
      maxTokens: 900,
    });
  } catch (error) {
    if (error instanceof GroqCallError && error.status === 401 && resolvedKey.source === "user") {
      return { ok: false, reason: "invalid_user_key" };
    }
    const detail =
      error instanceof GroqCallError
        ? `${error.status} ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    console.error("Generazione review settimanale fallita:", detail);
    return { ok: false, reason: "ai_error" };
  }

  const { comment: stripped, notes, discarded } = extractCoachNotes(rawText);
  const narrative = stripped || rawText.trim();

  const metrics = {
    actual,
    execution,
    divergences,
    trends,
    hardPlanned,
    hardCompleted,
    hardMissed,
    acwr,
    tsb,
    avgEasyAboveCeilingFraction,
    maxDecouplingPct,
    sleepAvgHoursFromIntervals,
  };

  const { error: saveError } = await admin.from("weekly_reviews").upsert(
    {
      user_id: userId,
      week_start: week.weekStart,
      feel,
      metrics,
      narrative,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start" }
  );
  if (saveError) {
    console.error("Salvataggio review settimanale fallito:", saveError.message);
    return { ok: false, reason: "internal_error" };
  }

  if (notes.length > 0) {
    const { error: memError } = await admin.from("athlete_memory").upsert(
      notes.map((n) => ({ user_id: userId, memory_type: n.tipo, nota: n.nota })),
      { onConflict: "user_id,nota", ignoreDuplicates: true }
    );
    if (memError) {
      console.error("Salvataggio note coach fallito:", memError.message);
    }
  }

  const unexpectedNumbers = findUnexpectedNumbers(narrative, prompt.allowedNumbers);
  await admin.from("audit_logs").insert({
    user_id: userId,
    action: "review.weekly_generate",
    source: "weekly_review",
    payload: {
      model: DEFAULT_AI_MODEL,
      week_start: week.weekStart,
      narrative_chars: narrative.length,
      unexpected_numbers: unexpectedNumbers,
      coach_notes_saved: notes.length,
      coach_notes_discarded: discarded,
      streams_fetched: streamByDate.size,
    },
  });

  return { ok: true, weekStart: week.weekStart };
}
