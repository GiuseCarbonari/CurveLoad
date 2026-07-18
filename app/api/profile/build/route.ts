import { NextResponse } from "next/server";

import { decryptToken } from "@/lib/crypto";
import { IntervalsApiError, IntervalsFetcher } from "@/lib/intervals-client";
import { buildAthleteProfile } from "@/lib/profile/build-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/profile/build — (ri)costruisce la scheda atleta (PRD §33).
 *
 * Legge power-curves e profilo da Intervals (endpoint verificati), compone
 * profile_data con le funzioni pure di lib/profile/ e lo salva in
 * athlete_profiles. NON tocca athlete_metrics_snapshots: la readiness è un
 * flusso separato (sync), il profilo fenotipo è un altro.
 */
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

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("intervals_connections")
    .select("access_token_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!connection) {
    return NextResponse.json(
      {
        success: false,
        error: "not_connected",
        message: "Nessun account Intervals collegato",
      },
      { status: 409 }
    );
  }

  // FTP dichiarato dal dossier: fallback finché non c'è una stima da power-curves.
  const { data: dossier } = await admin
    .from("athlete_profiles")
    .select("ftp_outdoor_w")
    .eq("user_id", user.id)
    .maybeSingle();
  const declaredFtpW =
    typeof dossier?.ftp_outdoor_w === "number" ? dossier.ftp_outdoor_w : null;

  const fetcher = new IntervalsFetcher(
    decryptToken(connection.access_token_encrypted)
  );

  return buildCyclist(fetcher, admin, supabase, user.id, declaredFtpW);
}

/** Percorso ciclismo: power-curves → CP/W′ (PRD §33). */
async function buildCyclist(
  fetcher: IntervalsFetcher,
  admin: ReturnType<typeof createAdminClient>,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  declaredFtpW: number | null
) {
  let powerCurves;
  let athleteRaw;
  try {
    [powerCurves, athleteRaw] = await Promise.all([
      fetcher.getPowerCurves(),
      fetcher.getProfile(),
    ]);
  } catch (error) {
    if (error instanceof IntervalsApiError && error.status === 401) {
      return handleTokenInvalid(admin, userId);
    }
    const status = error instanceof IntervalsApiError ? error.status : null;
    console.error(
      `Build profilo fallita: ${status ? `HTTP ${status}` : "errore di rete"}`
    );
    return NextResponse.json(
      {
        success: false,
        error: "api_error",
        message: "Lettura dati da Intervals fallita, riprova",
      },
      { status: 502 }
    );
  }

  let profileData;
  try {
    profileData = buildAthleteProfile(powerCurves, athleteRaw, undefined, declaredFtpW);
  } catch (error) {
    console.error(
      "Build profilo fallita:",
      error instanceof Error ? error.message : "errore sconosciuto"
    );
    return NextResponse.json(
      {
        success: false,
        error: "build_error",
        message: "Dati power curve insufficienti per costruire il profilo",
      },
      { status: 422 }
    );
  }

  // Upsert col client UTENTE: le policy RLS su athlete_profiles consentono
  // insert/update della propria riga — il dossier è dell'atleta, non serve
  // service role. updated_at lo aggiorna il trigger del DB.
  const { error: upsertError } = await supabase
    .from("athlete_profiles")
    .upsert({ user_id: userId, profile_data: profileData }, { onConflict: "user_id" });
  if (upsertError) {
    console.error("Salvataggio profilo fallito:", upsertError.message);
    return NextResponse.json(
      {
        success: false,
        error: "internal_error",
        message: "Salvataggio profilo fallito",
      },
      { status: 500 }
    );
  }

  await admin.from("audit_logs").insert({
    user_id: userId,
    action: "profile.built",
    source: "profile_build",
    payload: {
      phenotype: profileData.phenotype.primary,
      confidence: profileData.meta.confidence,
      cp_w: profileData.cp_wprime?.cp_w ?? null,
      model: profileData.cp_wprime?.model ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    phenotype: profileData.phenotype.primary,
    confidence: profileData.meta.confidence,
  });
}

/** Token revocato lato Intervals: cancella la connessione e logga. */
async function handleTokenInvalid(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
) {
  // Stesso comportamento del sync: token morto → connessione cancellata,
  // il middleware riporterà l'utente a /connect.
  await admin.from("intervals_connections").delete().eq("user_id", userId);
  await admin.from("audit_logs").insert({
    user_id: userId,
    action: "intervals.token_invalid",
    source: "profile_build",
    payload: {},
  });
  return NextResponse.json(
    {
      success: false,
      error: "intervals_unauthorized",
      message: "Sessione Intervals scaduta — riconnetti",
    },
    { status: 401 }
  );
}
