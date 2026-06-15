import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { BuildProfileButton } from "@/components/profile/build-button";
import { CalibrateButton } from "@/components/profile/calibrate-button";
import { CalibrationHelp } from "@/components/profile/calibration-help";
import {
  EventAnalysis,
  type SavedGapAnalysis,
} from "@/components/profile/event-analysis";
import { ExplainButton } from "@/components/profile/explain-button";
import { GapAnalysisButton } from "@/components/profile/gap-analysis-button";
import { HowToRead } from "@/components/profile/how-to-read";
import { InfoTooltip } from "@/components/profile/info-tooltip";
import { RaceEstimateView } from "@/components/profile/race-estimate";
import { isAIConfigured } from "@/lib/ai/provider";
import type { AthleteProfileData } from "@/lib/profile/build-profile";
import type { PhenotypePrimary } from "@/lib/profile/power-profile";
import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import type { RaceEstimateV2 } from "@/lib/terrain/race-estimator-v2";
import { createClient } from "@/lib/supabase/server";

/**
 * Pagina /profile — scheda atleta (Modulo Profilo §33).
 *
 * Mostra profile_data così com'è stato costruito e salvato: la pagina
 * presenta, non calcola. CP/W′/pMax sono LETTI da Intervals (tooltip
 * esplicito); le soglie del fenotipo sono dichiarate v0 in UI (onestà,
 * regola ferma del milestone). Le icone "?" attingono al glossario
 * (lib/profile/glossary.ts), trascritto esatto dal file docs.
 */

const PHENOTYPE_LABELS: Record<PhenotypePrimary, string> = {
  diesel: "Diesel",
  all_rounder: "All-rounder",
  puncheur: "Puncheur",
  sprinter: "Sprinter",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "alta",
  medium: "media",
  low: "bassa",
};

/** Durate mostrate nella tabella RPP (spec milestone: 5s, 1m, 5m, 20m, 60m). */
const RPP_DISPLAY: Array<{ secs: number; label: string }> = [
  { secs: 5, label: "5s" },
  { secs: 60, label: "1min" },
  { secs: 300, label: "5min" },
  { secs: 1200, label: "20min" },
  { secs: 3600, label: "60min" },
];

/** Frase descrittiva deterministica del fenotipo (combinazioni note). */
function phenotypePhrase(
  primary: PhenotypePrimary,
  secondary: PhenotypePrimary | null
): string {
  if (primary === "diesel" && secondary === "sprinter")
    return "Diesel con punta neuromuscolare: motore aerobico piatto e sostenibile, con uno sprint di picco notevole.";
  if (primary === "diesel" && secondary === "puncheur")
    return "Diesel con buon punch: profilo sostenibile, capace di accelerazioni sopra soglia.";
  if (primary === "diesel")
    return "Diesel: profilo piatto e sostenibile, costruito per sforzi lunghi e costanti.";
  if (primary === "puncheur" && secondary === "sprinter")
    return "Puncheur esplosivo: forte negli sforzi di 1–3 minuti e nello sprint.";
  if (primary === "puncheur")
    return "Puncheur: forte negli sforzi brevi e intensi rispetto alla soglia.";
  if (primary === "sprinter")
    return "Sprinter: la potenza di picco domina il profilo.";
  return "All-rounder: profilo bilanciato, senza un tratto dominante.";
}

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login"); // difesa in profondità oltre il middleware
  }

  const { data: row } = await supabase
    .from("athlete_profiles")
    .select(
      "profile_data, updated_at, ai_comment, ai_comment_at, gap_analysis, gap_analysis_at, event_terrain, race_estimate, race_estimate_at, signature_level, velocity_signature_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = (row?.profile_data ?? null) as AthleteProfileData | null;
  const cpw = profile?.cp_wprime ?? null;
  const apr = profile?.apr ?? null;
  const phenotype = profile?.phenotype ?? null;
  const aiConfigured = isAIConfigured();

  const gapAnalysis = (row?.gap_analysis ?? null) as SavedGapAnalysis | null;
  const eventTerrain = (row?.event_terrain ?? null) as TerrainSummary | null;
  // Stima tempi v2 (M7): firma di velocità calibrata + stima salvata.
  const signatureLevel = (row?.signature_level ?? null) as 1 | 2 | null;
  const raceEstimate = (row?.race_estimate ?? null) as RaceEstimateV2 | null;

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Scheda atleta
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Profilo fenotipo costruito dai tuoi sforzi reali su Intervals.icu.
          </p>
        </div>
        <BuildProfileButton />
      </div>

      {/* Box "Come leggere questa scheda" (collassabile, in cima). */}
      <HowToRead />

      {profile?.weight_source === "STRAVA" && (
        <div className="rounded-2xl border border-l-[3px] border-ready-modify-border border-l-ready-modify bg-surface p-4 text-sm text-secondary">
          Peso sincronizzato da Strava: i W/kg potrebbero non riflettere il
          peso più recente.
        </div>
      )}

      {!profile && (
        <div className="panel text-center text-muted">
          Nessun profilo ancora: premi «Aggiorna profilo» per costruirlo dai
          tuoi dati Intervals.
        </div>
      )}

      {profile && (
        <>
          {/* Confidence bassa: dirlo chiaro, non nasconderlo (regola ferma). */}
          {profile.meta.confidence === "low" && (
            <div className="rounded-2xl border border-l-[3px] border-ready-modify-border border-l-ready-modify bg-surface p-4 text-sm text-secondary">
              Confidenza BASSA: mancano sforzi massimali recenti su durate
              chiave (o il modello CP non è disponibile). Il profilo è
              indicativo — più sforzi massimali registri, più diventa
              affidabile.
            </div>
          )}

          {/* Card Fenotipo */}
          {phenotype && (
            <section className="panel">
              <div className="flex items-baseline justify-between">
                <h2 className="panel-title flex items-center gap-1.5">
                  Fenotipo
                  <InfoTooltip term="fenotipo" />
                </h2>
                <span className="flex items-center gap-1 text-xs text-muted">
                  confidenza {CONFIDENCE_LABELS[phenotype.confidence]}
                  <InfoTooltip term="confidenza" />
                </span>
              </div>
              <p className="my-3 flex flex-wrap items-center gap-x-1 text-3xl font-semibold text-amber">
                {PHENOTYPE_LABELS[phenotype.primary]}
                <InfoTooltip term={phenotype.primary} />
                {phenotype.secondary && (
                  <span className="text-xl font-medium text-secondary">
                    {" "}
                    · punta {PHENOTYPE_LABELS[phenotype.secondary]}
                  </span>
                )}
              </p>
              <p className="text-sm text-secondary">
                {phenotypePhrase(phenotype.primary, phenotype.secondary)}
              </p>
              <p className="mt-3 flex flex-wrap items-center gap-1 text-xs text-muted">
                Indicatori: {phenotype.basis.join(" · ")} — classificazione su
                soglie v0
                <InfoTooltip term="soglie_v0" />
                (euristiche da calibrare, PRD §33 C.5).
              </p>

              {/* Commento AI: predisposto ora, attivo con API key. */}
              <ExplainButton
                configured={aiConfigured}
                initialComment={row?.ai_comment ?? null}
                initialCommentAt={row?.ai_comment_at ?? null}
              />
            </section>
          )}

          {/* Card CP / W' */}
          <section className="panel">
            <h2 className="panel-title mb-3 flex items-center gap-1.5">
              Critical Power
              <InfoTooltip term="cp" />
            </h2>
            {cpw ? (
              <p
                className="flex flex-wrap items-center gap-x-1 text-[22px] font-medium text-amber"
                title="Letto da Intervals.icu, non ricalcolato"
              >
                CP {Math.round(cpw.cp_w)} W
                {cpw.cp_wkg != null && ` (${cpw.cp_wkg.toFixed(1)} W/kg)`}
                <InfoTooltip term="wkg" />
                <span>· W′ {cpw.w_prime_kj.toFixed(1)} kJ</span>
                <InfoTooltip term="wprime" />
                <span>
                  · modello {cpw.model === "MORTON_3P" ? "Morton 3P" : "MS 2P"}
                </span>
              </p>
            ) : (
              <p className="text-sm text-secondary">
                Nessun modello CP disponibile da Intervals: servono sforzi
                massimali tra ~3 e ~15 minuti nella finestra di 90 giorni.
              </p>
            )}
          </section>

          {/* Card APR/MPR */}
          {apr && (
            <section className="panel">
              <h2 className="panel-title mb-4 flex items-center gap-1.5">
                Riserva anaerobica (MPR)
                <InfoTooltip term="apr" />
              </h2>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="metric-card">
                  <dt className="flex items-center gap-1 text-[11px] uppercase tracking-[0.06em] text-muted">
                    MSP
                    <InfoTooltip term="msp" />
                  </dt>
                  <dd className="mt-1 text-[22px] font-medium">
                    {Math.round(apr.msp)} W
                  </dd>
                </div>
                <div className="metric-card">
                  <dt className="text-[11px] uppercase tracking-[0.06em] text-muted">
                    APR (MSP − CP)
                  </dt>
                  <dd className="mt-1 text-[22px] font-medium text-amber">
                    {Math.round(apr.apr)} W
                  </dd>
                </div>
                <div className="metric-card">
                  <dt className="text-[11px] uppercase tracking-[0.06em] text-muted">
                    Ratio
                  </dt>
                  <dd className="mt-1 text-[22px] font-medium">
                    {apr.apr_ratio.toFixed(2)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted">
                Denominatore CP (MPR, PRD §33 C.3): la MAP della risposta
                Intervals non è affidabile.
              </p>
            </section>
          )}

          {/* Tabella RPP */}
          <section className="panel">
            <h2 className="panel-title mb-4 flex items-center gap-1.5">
              Record Power Profile (90 giorni)
              <InfoTooltip term="rpp" />
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-[0.06em] text-muted">
                  <th className="py-2">Durata</th>
                  <th className="py-2 text-right">Watt</th>
                  <th className="py-2 text-right">W/kg</th>
                  <th className="py-2 text-right">
                    <span className="inline-flex items-center gap-1">
                      Best 1y (W)
                      <InfoTooltip term="best1y" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {RPP_DISPLAY.map(({ secs, label }) => {
                  const point = profile.rpp.find((p) => p.duration_s === secs);
                  return (
                    <tr key={secs} className="border-b last:border-0">
                      <td className="py-2">
                        {label}
                        {point && !point.exact && (
                          <span
                            className="cursor-help text-muted"
                            title={`Durata esatta non presente: valore del punto più vicino (${point.actual_secs ?? "—"}s)`}
                          >
                            {" "}
                            *
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right text-amber">
                        {point?.watts != null ? Math.round(point.watts) : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {point?.wkg != null ? point.wkg.toFixed(2) : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {point?.watts_1y != null
                          ? Math.round(point.watts_1y)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">
              Finestra corrente 90g · colonna «Best 1y» = riferimento
              potenziale (PRD §33 C.1). Tutti i valori letti da
              Intervals.icu.
            </p>
          </section>

          {/* Analisi evento target (gap analysis, §33 C.6) */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-secondary">
              Confronta il tuo profilo con le richieste della gara target dal
              tuo dossier.
            </p>
            <GapAnalysisButton hasAnalysis={gapAnalysis != null} />
          </div>

          {gapAnalysis && eventTerrain && (
            <EventAnalysis
              terrain={eventTerrain}
              analysis={gapAnalysis}
              generatedAt={(row?.gap_analysis_at ?? null) as string | null}
            />
          )}

          {/* Stima tempi gara v2 — modello a 3 livelli calibrato (M7) */}
          {eventTerrain && (
            <div className="flex flex-col gap-4">
              <CalibrationHelp />

              {/* a) Non calibrata */}
              {signatureLevel == null && (
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <p className="font-medium text-amber">
                    Stima tempi non ancora calibrata
                  </p>
                  <p className="mt-1 text-sm text-secondary">
                    Useremo le tue ultime attività MTB per imparare la tua
                    velocità reale su ogni tipo di terreno.
                  </p>
                  <div className="mt-3">
                    <CalibrateButton label="Calibra dai tuoi dati MTB" />
                  </div>
                </div>
              )}

              {/* b) Archetipo (livello 2) */}
              {signatureLevel === 2 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ready-modify-border bg-surface p-4">
                  <div>
                    <span className="rounded-[9px] bg-surface-2 px-2 py-1 text-xs font-medium text-ready-modify">
                      Basata su valori medi MTB
                    </span>
                    <p className="mt-2 text-sm text-secondary">
                      {raceEstimate?.activities_used != null
                        ? `Hai ${raceEstimate.activities_used} attività MTB analizzate. `
                        : ""}
                      Aggiungi più uscite MTB per una stima personalizzata.
                    </p>
                  </div>
                  <CalibrateButton label="Migliora con i tuoi dati" variant="outline" />
                </div>
              )}

              {/* c) Personale (livello 1) */}
              {signatureLevel === 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ready-go-border bg-surface p-4">
                  <div>
                    <span className="rounded-[9px] bg-surface-2 px-2 py-1 text-xs font-medium text-ready-go">
                      ✓ Calibrata sui tuoi dati
                    </span>
                    <p className="mt-2 text-sm text-secondary">
                      {raceEstimate?.source_breakdown
                        ? `Copertura terreno: ${raceEstimate.source_breakdown.L1}% dai tuoi dati`
                        : "Stima personalizzata sulle tue uscite MTB."}
                    </p>
                  </div>
                  <CalibrateButton label="Ricalibra" variant="outline" />
                </div>
              )}

              {/* Le 3 card tempo + dettagli (solo quando c'è una stima) */}
              {signatureLevel != null && raceEstimate && (
                <>
                  <RaceEstimateView
                    terrain={eventTerrain}
                    estimate={raceEstimate}
                    generatedAt={(row?.race_estimate_at ?? null) as string | null}
                  />
                  {raceEstimate.source_breakdown && (
                    <p className="text-xs text-muted">
                      Fonte della stima per distanza:{" "}
                      <span className="text-ready-go">L1 (tuoi dati) {raceEstimate.source_breakdown.L1}%</span>{" "}
                      ·{" "}
                      <span className="text-ready-modify">L2 (archetipo) {raceEstimate.source_breakdown.L2}%</span>{" "}
                      ·{" "}
                      <span className="text-secondary">L3 (fisica salita) {raceEstimate.source_breakdown.L3}%</span>
                    </p>
                  )}
                </>
              )}

              {/* Calibrata ma senza percorso analizzato: invita alla gap analysis */}
              {signatureLevel != null && !raceEstimate && (
                <p className="rounded-[11px] border border-border bg-surface p-4 text-sm text-secondary">
                  Firma di velocità pronta. Analizza un evento qui sopra per
                  vedere la stima tempi sul tuo percorso.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
