import { decryptToken } from "@/lib/crypto";
import {
  IntervalsApiError,
  IntervalsFetcher,
  type IntervalsActivity,
  type WellnessDay,
} from "@/lib/intervals-client";
import {
  computeReadiness,
  computeRiHistory,
  type ReadinessResult,
} from "@/lib/readiness";
import {
  computeRecoveryCalibration,
  recoveryInputsFromPreferences,
} from "@/lib/recovery/baselines";
import {
  hrvProtocolFromPreferences,
  latestHrvMeasurement,
  type HrvProtocol,
} from "@/lib/hrv";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sync dati Intervals.icu → snapshot mirror (Milestone 2).
 *
 * Logica condivisa tra POST /api/sync/intervals (bottone "Aggiorna dati")
 * e il callback OAuth (sync automatico al collegamento). Vive qui e non
 * nella route così il callback la invoca direttamente, senza una chiamata
 * HTTP interna a sé stessi con inoltro di cookie.
 *
 * Regole rispettate:
 *  - ctl/atl si LEGGONO dal wellness Intervals, mai ricalcolati;
 *  - il token decifrato vive solo nello scope di questa funzione: non viene
 *    mai loggato, restituito o passato al client;
 *  - su HTTP 401 da Intervals il token salvato non è più valido: si cancella
 *    la connessione (il middleware riporterà l'utente a /connect).
 */

/** Zone FC configurate su Intervals.icu per un gruppo di sport (sportSettings[]). */
export interface SportHrZones {
  max_hr: number | null;
  lthr: number | null;
  /** Limiti superiori Z1..Z7 in bpm, ordine crescente (7 zone stile Coggan di Intervals). */
  hr_zones: number[] | null;
}

/** Struttura del mirror salvato in athlete_metrics_snapshots.mirror_data. */
export interface MirrorData {
  fetched_at: string;
  athlete_profile: {
    name: string | null;
    weight: number | null;
    resting_hr: number | null;
    /** FTP dal campo icu_ftp/threshold_power oppure, in fallback, da sportSettings[Ride].ftp. */
    ftp: number | null;
    zones: unknown;
    /** Zone FC reali dell'atleta per bici/corsa, da sportSettings[] — non inventate,
     *  copiate dalla calibrazione che l'atleta ha già fatto su Intervals.icu.
     *  null se il gruppo di sport non è configurato. */
    hr_zones_bike?: SportHrZones | null;
    hr_zones_run?: SportHrZones | null;
  };
  /**
   * Wellness in ordine cronologico, ultimo = oggi. Finestra corrente: 60
   * giorni. Leggere SEMPRE con `wellnessOf()`, mai direttamente: gli snapshot
   * salvati prima portano ancora il nome storico `wellness_30d`.
   */
  wellness: WellnessDay[];
  /** @deprecated Nome di quando la finestra era di 30 giorni. Solo lettura. */
  wellness_30d?: WellnessDay[];
  activities_90d: IntervalsActivity[];
  hrv_protocol: HrvProtocol;
  readiness_today: ReadinessResult;
  data_quality_warning: "strava_source_detected" | null;
}

interface IntervalsSportSettingsRaw {
  types?: string[];
  ftp?: number | null;
  lthr?: number | null;
  max_hr?: number | null;
  hr_zones?: number[] | null;
}

/**
 * Trova il gruppo `sportSettings[]` che copre il tipo Intervals dato ("Ride"
 * o "Run"). Le zone/FTP reali dell'atleta vivono qui, non nei campi
 * top-level del profilo (`icu_ftp`/`threshold_power`/`zones` tornano
 * `null` sulla risposta vera — verificato via probe, vedi
 * docs/INTERVALS_API_NOTES.md). Esportata per i test.
 */
export function findSportSettings(
  profile: Record<string, unknown>,
  type: "Ride" | "Run"
): IntervalsSportSettingsRaw | null {
  const list = profile.sportSettings;
  if (!Array.isArray(list)) return null;
  return (
    (list as IntervalsSportSettingsRaw[]).find(
      (s) => Array.isArray(s?.types) && s.types.includes(type)
    ) ?? null
  );
}

/**
 * Unico modo di leggere il wellness da un mirror.
 *
 * Esiste perché il nome della chiave è cambiato quando la finestra è passata
 * da 30 a 60 giorni, e gli snapshot già salvati portano ancora quello vecchio.
 * Tenere la compatibilità in un posto solo evita sia di spargere `??` in 13
 * file, sia di far esplodere la dashboard di chi non ha ancora
 * risincronizzato. La prossima volta che la finestra cambia, qui non si tocca
 * niente.
 */
export function wellnessOf(
  mirror:
    | { wellness?: WellnessDay[]; wellness_30d?: WellnessDay[] }
    | null
    | undefined
): WellnessDay[] {
  if (!mirror) return [];
  return mirror.wellness ?? mirror.wellness_30d ?? [];
}

export type SyncOutcome =
  | { ok: true; snapshotId: string; readiness: ReadinessResult["decision"] }
  | { ok: false; reason: "not_connected" }
  | { ok: false; reason: "intervals_unauthorized" }
  | { ok: false; reason: "api_error"; status: number }
  | { ok: false; reason: "internal_error" };

/**
 * Giorni di wellness scaricati a ogni sync.
 *
 * 60 e non 30: il periodo di riferimento per le soglie personali sono questi
 * giorni meno la finestra mobile di 7, e con 30 servivano di fatto 4 misure
 * HRV a settimana per superare MIN_BASELINE_MEASURES. Chi ne fa 3 — la
 * compliance minima valida secondo Plews 2014 — non arrivava mai alle soglie
 * personali. Con 60 giorni ci arriva. Costo: ~30 righe wellness in più nello
 * snapshot, trascurabili accanto a 90 giorni di attività.
 */
const WELLNESS_WINDOW_DAYS = 60;

/**
 * Quanto indietro può pescare il carry-forward di HRV e FC riposo quando la
 * misura di oggi manca. Oltre una settimana il valore non descrive più lo
 * stato attuale: meglio un segnale "non disponibile" onesto di un numero
 * vecchio spacciato per attuale.
 */
const CARRY_FORWARD_MAX_DAYS = 7;

/** Data locale in formato YYYY-MM-DD, spostata di `offsetDays` giorni. */
function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // en-CA produce il formato YYYY-MM-DD nel fuso orario locale del server.
  return d.toLocaleDateString("en-CA");
}

/**
 * Livello qualità dati 0–4 (PRD §11), euristica deterministica v0.
 * Determina cosa il coach potrà legittimamente raccomandare: più storico e
 * più segnali fisiologici → consigli più precisi.
 */
function computeDataQualityLevel(
  activities: IntervalsActivity[],
  wellness: WellnessDay[]
): 0 | 1 | 2 | 3 | 4 {
  if (activities.length === 0) return 0;

  const hasPowerOrHr = activities.some(
    (a) => a.icu_weighted_avg_watts != null || a.average_heartrate != null
  );
  if (!hasPowerOrHr) return 1;

  // Estensione dello storico osservato nella finestra scaricata (90 giorni).
  const dates = activities
    .map((a) => Date.parse(a.start_date_local))
    .filter((t) => !Number.isNaN(t));
  const spanDays =
    dates.length > 0
      ? (Date.now() - Math.min(...dates)) / (1000 * 60 * 60 * 24)
      : 0;

  const hasWellnessSignals = wellness.some(
    (w) =>
      w.hrv != null ||
      w.hrvSDNN != null ||
      w.restingHR != null ||
      w.sleepSecs != null
  );
  const hasRpe = activities.some((a) => a.perceived_exertion != null);

  if (spanDays >= 90 && hasWellnessSignals && hasRpe) return 4;
  if (spanDays >= 28 && hasWellnessSignals) return 3;
  if (spanDays >= 14) return 2;
  return 1;
}

export async function syncIntervalsData(userId: string): Promise<SyncOutcome> {
  const admin = createAdminClient();

  // Token cifrato dalla connessione dell'utente (lettura con service role:
  // le route hanno già verificato l'identità Supabase del chiamante).
  const { data: connection } = await admin
    .from("intervals_connections")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (!connection) {
    return { ok: false, reason: "not_connected" };
  }

  const { data: athleteSettings, error: settingsError } = await admin
    .from("athlete_profiles")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();
  if (settingsError) {
    console.error("Lettura preferenza HRV fallita:", settingsError.message);
  }
  const hrvProtocol = hrvProtocolFromPreferences(
    athleteSettings?.preferences
  );

  let fetcher: IntervalsFetcher;
  try {
    fetcher = new IntervalsFetcher(
      decryptToken(connection.access_token_encrypted)
    );
  } catch {
    // Token non decifrabile (chiave cambiata o dato corrotto): inutilizzabile.
    console.error("Token Intervals non decifrabile per l'utente corrente");
    return { ok: false, reason: "internal_error" };
  }

  const today = localDate(0);

  let profileRaw;
  let wellnessWindow: WellnessDay[];
  let activities90d: IntervalsActivity[];
  try {
    [profileRaw, wellnessWindow, activities90d] = await Promise.all([
      fetcher.getProfile(),
      fetcher.getWellness(localDate(-WELLNESS_WINDOW_DAYS), today),
      fetcher.getActivities(localDate(-90)),
    ]);
  } catch (error) {
    if (error instanceof IntervalsApiError) {
      if (error.status === 401) {
        // Token revocato lato Intervals: la connessione salvata è morta.
        // Si cancella così l'utente viene guidato a riconnettersi.
        await admin
          .from("intervals_connections")
          .delete()
          .eq("user_id", userId);
        await admin.from("audit_logs").insert({
          user_id: userId,
          action: "intervals.token_invalid",
          source: "sync",
          payload: {},
        });
        return { ok: false, reason: "intervals_unauthorized" };
      }
      console.error(`Sync Intervals fallito: HTTP ${error.status}`);
      return { ok: false, reason: "api_error", status: error.status };
    }
    console.error("Sync Intervals fallito: errore di rete");
    return { ok: false, reason: "internal_error" };
  }

  // --- Gate Strava (PRD §11) ----------------------------------------------
  // Dispositivi che passano da Strava arrivano con i campi potenza spogliati.
  // Controllo da specifica: ultime 5 attività con icu_weighted_avg_watts
  // tutti null → avviso (non bloccante, mostrato in dashboard).
  const recentActivities = [...activities90d]
    .sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))
    .slice(0, 5);
  const stravaWarning =
    recentActivities.length > 0 &&
    recentActivities.every((a) => a.icu_weighted_avg_watts == null);

  // --- Readiness deterministica --------------------------------------------
  // "Oggi" = riga wellness più recente disponibile (Intervals crea la riga
  // del giorno con ctl/atl anche senza dati soggettivi); baseline = i 7
  // giorni che la precedono.
  const wellnessSorted = [...wellnessWindow].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const wellnessToday = wellnessSorted.at(-1) ?? null;
  const history7d = wellnessSorted.slice(-8, -1);

  // Carry-forward: se oggi la misura manca si usa l'ultima nota, ma solo se
  // recente. Una HRV di sei settimane fa non dice niente su come stai adesso,
  // e prima di questo limite la ricerca spazzolava l'intera finestra: passando
  // da 30 a 60 giorni avrebbe iniziato a ripescare misure vecchie il doppio.
  const wellnessExcludingToday = wellnessSorted.slice(
    -CARRY_FORWARD_MAX_DAYS - 1,
    -1
  );
  const lastKnownHrv = latestHrvMeasurement(wellnessExcludingToday, hrvProtocol);
  const lastKnownRhr = (() => {
    for (let i = wellnessExcludingToday.length - 1; i >= 0; i--) {
      const v = wellnessExcludingToday[i].restingHR;
      if (v != null) return { value: v, date: wellnessExcludingToday[i].date };
    }
    return null;
  })();

  // Soglie calibrate sulla storia dell'atleta e sulle sue risposte in
  // impostazioni. Se lo storico è corto o rado torna soglie nulle e la
  // readiness resta sui numeri fissi di sempre.
  const calibration = computeRecoveryCalibration(
    wellnessSorted,
    hrvProtocol,
    recoveryInputsFromPreferences(athleteSettings?.preferences)
  );

  const readinessToday = computeReadiness(wellnessToday, history7d, {
    hrvProtocol,
    lastKnownHrv,
    lastKnownRhr,
    // Senza questa serie la regola "RI < 0.7 per 2+ giorni" non scatta mai.
    riHistory: computeRiHistory(wellnessSorted, hrvProtocol),
    calibration,
  });

  // --- Profilo: sottoinsieme verificato ------------------------------------
  const profile = profileRaw as Record<string, unknown>;
  const bikeSettings = findSportSettings(profile, "Ride");
  const runSettings = findSportSettings(profile, "Run");
  const athleteProfile: MirrorData["athlete_profile"] = {
    name: (profile.name as string) ?? null,
    weight: (profile.weight as number) ?? null,
    resting_hr: (profile.resting_hr as number) ?? null,
    ftp:
      (profile.icu_ftp as number) ??
      (profile.threshold_power as number) ??
      bikeSettings?.ftp ??
      null,
    zones: profile.zones ?? null,
    hr_zones_bike: bikeSettings
      ? {
          max_hr: bikeSettings.max_hr ?? null,
          lthr: bikeSettings.lthr ?? null,
          hr_zones: bikeSettings.hr_zones ?? null,
        }
      : null,
    hr_zones_run: runSettings
      ? {
          max_hr: runSettings.max_hr ?? null,
          lthr: runSettings.lthr ?? null,
          hr_zones: runSettings.hr_zones ?? null,
        }
      : null,
  };

  const mirrorData: MirrorData = {
    fetched_at: new Date().toISOString(),
    athlete_profile: athleteProfile,
    wellness: wellnessSorted,
    activities_90d: activities90d,
    hrv_protocol: hrvProtocol,
    readiness_today: readinessToday,
    data_quality_warning: stravaWarning ? "strava_source_detected" : null,
  };

  const dataQualityLevel = computeDataQualityLevel(activities90d, wellnessWindow);

  // Snapshot immutabile: ogni sync inserisce una riga nuova (audit-first);
  // la dashboard legge sempre la più recente.
  const { data: snapshot, error: snapshotError } = await admin
    .from("athlete_metrics_snapshots")
    .insert({
      user_id: userId,
      source: "intervals_api",
      snapshot_date: today,
      mirror_data: mirrorData,
      data_quality_level: dataQualityLevel,
    })
    .select("id")
    .single();
  if (snapshotError || !snapshot) {
    console.error(
      "Salvataggio snapshot fallito:",
      snapshotError?.message ?? "riga mancante"
    );
    return { ok: false, reason: "internal_error" };
  }

  await admin.from("audit_logs").insert({
    user_id: userId,
    action: "intervals.synced",
    source: "sync",
    payload: {
      snapshot_id: snapshot.id,
      readiness: readinessToday.decision,
      activities_count: activities90d.length,
      data_quality_level: dataQualityLevel,
      data_quality_warning: stravaWarning ? "strava_source_detected" : null,
    },
  });

  return {
    ok: true,
    snapshotId: snapshot.id,
    readiness: readinessToday.decision,
  };
}
