import { NextResponse } from "next/server";

import { decryptToken } from "@/lib/crypto";
import { IntervalsApiError, IntervalsFetcher } from "@/lib/intervals-client";
import { buildAthleteProfile } from "@/lib/profile/build-profile";
import { buildRunnerProfile } from "@/lib/profile/pace-profile";
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

  const fetcher = new IntervalsFetcher(
    decryptToken(connection.access_token_encrypted)
  );

  return buildProfiles(fetcher, admin, supabase, user.id);
}

/** Percorso ciclismo: power-curves → CP/W′ (PRD §33). */
async function buildProfiles(
  fetcher: IntervalsFetcher,
  admin: ReturnType<typeof createAdminClient>,
  supabase: ReturnType<typeof createClient>,
  userId: string
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

  // FTP dichiarato: non più un campo del wizard (l'onboarding non lo chiede
  // più, migration 024) ma icu_ftp/threshold_power, che Intervals restituisce
  // già in questa stessa getProfile() — stesso fallback usato dal mirror di
  // sync (lib/intervals/sync.ts).
  const declaredFtpW =
    (athleteRaw.icu_ftp as number | undefined) ??
    (athleteRaw.threshold_power as number | undefined) ??
    null;

  // Ramo corsa (Passo 9), fail-soft assoluto: chi non corre (o l'endpoint
  // pace-curves fallisce per qualunque motivo — 404, 401, rete, parsing) non
  // deve mai far fallire il profilo bici. Errore ingoiato e loggato senza
  // token né body. Va PRIMA del ramo bici (bug §0): se buildAthleteProfile
  // lancia (chi corre e basta non ha power-curves), runnerData deve già
  // essere pronto per essere salvato nel catch qui sotto.
  let runnerData = null;
  try {
    runnerData = buildRunnerProfile(await fetcher.getPaceCurves());
  } catch (error) {
    console.error(
      "Build profilo corsa fallita (ignorato, il profilo bici non ne risente):",
      error instanceof Error ? error.message : "errore sconosciuto"
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
    // Chi corre e basta non ha power-curves: buildAthleteProfile lancia
    // sempre per lui. Se il ramo corsa sopra ha comunque prodotto un
    // runnerData valido, il profilo di corsa va salvato lo stesso (§0) invece
    // di rispondere 422 secco come se non ci fosse nulla da salvare.
    if (runnerData != null) {
      const { error: upsertError } = await supabase.from("athlete_profiles").upsert(
        { user_id: userId, runner_profile_data: runnerData },
        { onConflict: "user_id" }
      );
      if (upsertError) {
        console.error("Salvataggio profilo corsa fallito:", upsertError.message);
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
          phenotype: null,
          confidence: runnerData.meta.confidence,
          cp_w: null,
          model: null,
          cs_mps: runnerData.cs_dprime?.cs_mps ?? null,
        },
      });

      return NextResponse.json({
        success: true,
        phenotype: null,
        confidence: runnerData.meta.confidence,
      });
    }

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
  // runner_profile_data entra nell'oggetto SOLO se runnerData non è null: se
  // la chiamata corsa fallisce, l'upsert Supabase non deve sovrascrivere con
  // null un profilo corsa buono salvato in precedenza (aggiorna solo le
  // colonne presenti nell'oggetto).
  const { error: upsertError } = await supabase.from("athlete_profiles").upsert(
    {
      user_id: userId,
      profile_data: profileData,
      ...(runnerData != null ? { runner_profile_data: runnerData } : {}),
    },
    { onConflict: "user_id" }
  );
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
      cs_mps: runnerData?.cs_dprime?.cs_mps ?? null,
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
