import { NextResponse } from "next/server";

import { decryptToken } from "@/lib/crypto";
import {
  IntervalsApiError,
  IntervalsFetcher,
  type IntervalsEvent,
} from "@/lib/intervals-client";
import type { AthleteProfileData } from "@/lib/profile/build-profile";
import { computeGapAnalysis } from "@/lib/terrain/gap-analysis";
import { detectClimbs, parseGPX } from "@/lib/terrain/gpx-parser";
import { computeRaceEstimateV2 } from "@/lib/terrain/race-estimator-v2";
import type { VelocitySignature } from "@/lib/terrain/velocity-signature";
import type { MirrorData } from "@/lib/intervals/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * /api/profile/gap-analysis — analisi evento target (PRD §33 C.6).
 *
 * GET  → lista delle gare RACE_A future dell'utente che hanno un GPX allegato
 *        (per farne scegliere una in UI).
 * POST → esegue l'analisi su:
 *        - { event_id }  (JSON)            → scarica il GPX di quell'evento;
 *        - file `gpx`    (multipart)       → parsa il GPX caricato al volo
 *                                            (NON salvato sul server).
 * In entrambi i casi: parseGPX → detectClimbs → computeGapAnalysis, salva
 * gap_analysis + event_terrain in athlete_profiles. Tutto deterministico.
 *
 * Unico endpoint Intervals usato: /athlete/0/events (verificato). Il GPX si
 * scarica da attachments[].url (GCS pubblico, senza auth).
 */

export const dynamic = "force-dynamic";

/** Data locale YYYY-MM-DD con offset di giorni. */
function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA");
}

/** Allegato GPX: preferisce .gpx/mimetype gpx, altrimenti il primo con url. */
function pickGpxAttachment(event: IntervalsEvent) {
  const atts = (event.attachments ?? []).filter((a) => a.url);
  if (atts.length === 0) return null;
  return (
    atts.find(
      (a) =>
        (a.filename ?? "").toLowerCase().endsWith(".gpx") ||
        (a.mimetype ?? "").toLowerCase().includes("gpx")
    ) ?? atts[0]
  );
}

/** Costruisce un fetcher Intervals per l'utente, o null se non collegato. */
async function getFetcher(
  userId: string
): Promise<IntervalsFetcher | null> {
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("intervals_connections")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (!connection) return null;
  return new IntervalsFetcher(decryptToken(connection.access_token_encrypted));
}

// --- GET: lista eventi selezionabili ----------------------------------------

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const fetcher = await getFetcher(user.id);
  if (!fetcher) {
    // Non collegato: niente lista, ma il caricamento file resta possibile.
    return NextResponse.json({ success: true, events: [], error: "not_connected" });
  }

  let events: IntervalsEvent[];
  try {
    events = await fetcher.getEvents(localDate(), localDate(730), "RACE_A");
  } catch (error) {
    const status = error instanceof IntervalsApiError ? error.status : null;
    console.error(`Lista eventi fallita: ${status ? `HTTP ${status}` : "rete"}`);
    return NextResponse.json({ success: true, events: [], error: "api_error" });
  }

  // Solo eventi con un GPX allegato (altrimenti non c'è nulla da analizzare).
  const available = events
    .filter((e) => pickGpxAttachment(e) != null)
    .map((e) => ({
      id: e.id,
      name: e.name,
      start_date_local: e.start_date_local,
      distance_km: e.distance != null ? Number((e.distance / 1000).toFixed(1)) : null,
    }))
    .sort((a, b) =>
      (a.start_date_local ?? "").localeCompare(b.start_date_local ?? "")
    );

  return NextResponse.json({ success: true, events: available });
}

// --- POST: esegue l'analisi (event_id JSON oppure file multipart) -----------

interface EventMeta {
  id: number | string | null;
  name: string | null;
  start_date_local: string | null;
  distance_km: number | null;
}

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

  // Profilo costruito: serve a entrambi i rami (cp/rpp/peso). La firma di
  // velocità (M7) serve a ricalcolare la stima tempi con il modello v2.
  const { data: row } = await supabase
    .from("athlete_profiles")
    .select("profile_data, velocity_signature")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = (row?.profile_data ?? null) as AthleteProfileData | null;
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

  const contentType = request.headers.get("content-type") ?? "";

  // Raccoglie il testo GPX e i metadati evento dal ramo appropriato.
  let gpxText: string;
  let eventMeta: EventMeta;

  if (contentType.includes("multipart/form-data")) {
    // --- Ramo file caricato: parsa al volo, NON salva il file ---------------
    const formData = await request.formData();
    const file = formData.get("gpx");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "no_file", message: "Nessun file GPX ricevuto" },
        { status: 400 }
      );
    }
    gpxText = await file.text();
    eventMeta = {
      id: null,
      name: file.name.replace(/\.gpx$/i, "") || "Percorso caricato",
      start_date_local: null,
      distance_km: null, // ricavato dal terreno più sotto
    };
  } else {
    // --- Ramo evento Intervals: scarica il GPX dell'evento scelto -----------
    const body = (await request.json().catch(() => ({}))) as {
      event_id?: number | string;
    };
    if (body.event_id == null) {
      return NextResponse.json(
        { success: false, error: "no_event_id", message: "Nessun evento selezionato" },
        { status: 400 }
      );
    }

    const fetcher = await getFetcher(user.id);
    if (!fetcher) {
      return NextResponse.json(
        { success: false, error: "not_connected", message: "Nessun account Intervals collegato" },
        { status: 409 }
      );
    }

    let events: IntervalsEvent[];
    try {
      events = await fetcher.getEvents(localDate(), localDate(730), "RACE_A");
    } catch (error) {
      if (error instanceof IntervalsApiError && error.status === 401) {
        await createAdminClient()
          .from("intervals_connections")
          .delete()
          .eq("user_id", user.id);
        return NextResponse.json(
          { success: false, error: "intervals_unauthorized", message: "Sessione Intervals scaduta — riconnetti" },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { success: false, error: "api_error", message: "Lettura eventi da Intervals fallita" },
        { status: 502 }
      );
    }

    const event = events.find((e) => String(e.id) === String(body.event_id));
    if (!event) {
      return NextResponse.json(
        { success: false, error: "no_event", message: "Evento non trovato tra le gare RACE_A" },
        { status: 404 }
      );
    }

    const attachment = pickGpxAttachment(event);
    if (!attachment?.url) {
      return NextResponse.json(
        {
          success: false,
          error: "no_gpx",
          message: `La gara «${event.name ?? "senza nome"}» non ha un GPX allegato`,
        },
        { status: 422 }
      );
    }

    try {
      const gpxResponse = await fetch(attachment.url, { cache: "no-store" });
      if (!gpxResponse.ok) {
        console.error(`Download GPX fallito: HTTP ${gpxResponse.status}`);
        return NextResponse.json(
          { success: false, error: "gpx_download_failed", message: "Download del GPX fallito" },
          { status: 502 }
        );
      }
      gpxText = await gpxResponse.text();
    } catch {
      return NextResponse.json(
        { success: false, error: "gpx_download_failed", message: "Download del GPX fallito" },
        { status: 502 }
      );
    }

    eventMeta = {
      id: event.id,
      name: event.name,
      start_date_local: event.start_date_local,
      distance_km:
        event.distance != null ? Number((event.distance / 1000).toFixed(1)) : null,
    };
  }

  // --- Parsing + analisi (comune ai due rami) -------------------------------
  const parsed = parseGPX(gpxText);
  if (parsed.points.length < 2) {
    return NextResponse.json(
      {
        success: false,
        error: "gpx_invalid",
        message: "Il GPX non contiene punti con elevazione validi",
      },
      { status: 422 }
    );
  }

  const terrain = detectClimbs(parsed.points);
  const analysis = computeGapAnalysis(terrain, profile, ctlToday);

  // Distanza: dall'evento se nota, altrimenti dal terreno (file caricato).
  if (eventMeta.distance_km == null) {
    eventMeta.distance_km = terrain.total_distance_km;
  }

  const generatedAt = new Date().toISOString();
  const gapAnalysis = { event: eventMeta, ...analysis };

  // Stima tempi v2 (M7): si aggiorna con la nuova analisi evento SOLO se esiste
  // una firma di velocità (calibrata o archetipo) oltre a CP e peso. Senza
  // firma non si scrive race_estimate (la UI invita a calibrare).
  const raceEstimate =
    signature && profile.cp_wprime?.cp_w && profile.weight_kg != null
      ? computeRaceEstimateV2(
          terrain,
          signature,
          profile.cp_wprime.cp_w,
          profile.weight_kg,
          ctlToday
        )
      : null;

  const update: Record<string, unknown> = {
    gap_analysis: gapAnalysis,
    gap_analysis_at: generatedAt,
    event_terrain: terrain,
  };
  if (raceEstimate) {
    update.race_estimate = raceEstimate;
    update.race_estimate_at = generatedAt;
  }

  const { error: saveError } = await supabase
    .from("athlete_profiles")
    .update(update)
    .eq("user_id", user.id);
  if (saveError) {
    console.error("Salvataggio gap analysis fallito:", saveError.message);
  }

  await createAdminClient().from("audit_logs").insert({
    user_id: user.id,
    action: "profile.gap_analysis",
    source: "gap_analysis",
    payload: {
      event_id: eventMeta.id,
      event_name: eventMeta.name,
      input: contentType.includes("multipart/form-data") ? "upload" : "intervals",
      climbs: terrain.climbs.length,
      course_character: terrain.course_character,
      limiters: analysis.limiters.length,
      saved: !saveError,
    },
  });

  return NextResponse.json({
    success: true,
    gap_analysis: gapAnalysis,
    event_terrain: terrain,
    generated_at: generatedAt,
  });
}
