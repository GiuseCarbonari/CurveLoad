"use client";

import { BuildProfileButton } from "./build-button";
import { ExplainProfileButton } from "./explain-profile-button";
import { InfoTooltip } from "./info-tooltip";
import type { AthleteProfileData } from "@/lib/profile/build-profile";

const RPP_DISPLAY: Array<{ secs: number; label: string }> = [
  { secs: 5, label: "5s" },
  { secs: 60, label: "1 min" },
  { secs: 300, label: "5 min" },
  { secs: 1200, label: "20 min" },
  { secs: 3600, label: "60 min" },
];

const PHENOTYPE_LABEL: Record<string, string> = {
  diesel: "Diesel — resistenza aerobica dominante",
  all_rounder: "All-rounder — profilo completo",
  puncheur: "Puncheur — efficace nei cambi di ritmo",
  sprinter: "Sprinter — picco neuromuscolare marcato",
};

interface ProfileTabsProps {
  profile: AthleteProfileData | null;
  cpw: {
    cp_w: number;
    cp_wkg: number | null;
    w_prime_j: number;
    w_prime_kj: number;
    p_max_w: number | null;
    ftp_model_w: number | null;
    model: "MORTON_3P" | "MS_2P" | "FFT_CURVES" | "ECP";
    source: string;
  } | null;
  row: unknown;
  /** Chiave Groq disponibile: propria o fallback server (mai la chiave stessa). */
  aiEnabled: boolean;
  aiComment: string | null;
  aiCommentAt: string | null;
  /** Taccuino del coach (athlete_memory, Passo 5) — note più recenti prima. */
  coachNotes: Array<{
    id: string;
    created_at: string;
    memory_type: string;
    nota: string;
  }>;
  /** Chi corre e basta: nasconde tutta la parte bici (hero CP, power-law,
   * W′/Pmax, tabella RPP) — quella corsa vive in <RunnerCard/>. Default
   * false = comportamento odierno. */
  isRunner?: boolean;
  /** true se athlete_profiles.runner_profile_data non è null. Un corridore
   * puro non ha mai profile_data (bici): senza questo flag lo stato vuoto e
   * il commento AI/taccuino resterebbero gated solo su `profile` e
   * sparirebbero per lui anche a build riuscita. Default false. */
  hasRunnerProfile?: boolean;
}

export function ProfileTabs({
  profile,
  cpw,
  row,
  aiEnabled,
  aiComment,
  aiCommentAt,
  coachNotes,
  isRunner = false,
  hasRunnerProfile = false,
}: ProfileTabsProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
            Profilo atleta
          </div>
          <h1 className="mt-1.5 font-serif text-[30px] font-medium leading-none text-foreground">
            La tua firma
          </h1>
        </div>
        <div className="mt-1 shrink-0">
          <BuildProfileButton />
        </div>
      </div>

      {!profile && !hasRunnerProfile && (
        <div className="mt-6 rounded-metric border border-border bg-surface px-6 py-10 text-center">
          <p className="font-serif text-lg text-foreground">
            Profilo non ancora costruito.
          </p>
          <p className="mt-2 text-sm text-muted">
            Premi «Aggiorna profilo» per leggere{" "}
            {isRunner ? "le curve di passo" : "la curva di potenza"} da
            Intervals.icu e creare la prima firma atleta.
          </p>
        </div>
      )}

      {(profile || hasRunnerProfile) && (
        <>
          {/* Profile content */}
          <div className="space-y-4 pt-4">
            {profile && (
              <>
              {/* Quality warnings */}
              {profile.meta.confidence === "low" && (
                <div className="rounded-lg border border-l-[3px] border-ready-modify-border border-l-ready-modify bg-surface px-4 py-3 text-[13px] text-secondary">
                  Confidenza bassa: mancano sforzi massimali recenti. Il profilo è
                  indicativo.
                </div>
              )}
              {/* CP Hero — solo bici, un corridore vede la sua Corsa · Velocità
                  critica in <RunnerCard/> invece. */}
              {!isRunner &&
                (cpw ? (
                  <div id="tour-cp-hero" className="rounded-metric border border-border bg-gradient-to-br from-brand/[0.10] to-surface-2/60 px-6 py-7">
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted">
                        Potenza critica
                      </span>
                      <InfoTooltip term="cp" />
                    </div>
                    <div className="mt-1.5 flex items-end gap-2.5">
                      <span className="font-serif text-[58px] font-medium leading-none tabular-nums text-foreground">
                        {Math.round(cpw.cp_w)}
                      </span>
                      <span className="mb-2 font-serif text-[22px] text-secondary">W</span>
                      {cpw.cp_wkg != null && (
                        <span className="mb-2 text-[14px] text-muted">
                          {cpw.cp_wkg.toFixed(2)} W/kg
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-serif text-[14px] italic text-secondary">
                      {PHENOTYPE_LABEL[profile.phenotype.primary] ??
                        profile.phenotype.primary}
                    </p>
                    <PowerLawCompare cpw={cpw} powerLaw={profile.cp_power_law} />
                  </div>
                ) : (
                  <div className="rounded-metric border border-border bg-surface px-5 py-8 text-center text-sm text-muted">
                    Dati CP non disponibili — aggiorna il profilo.
                  </div>
                ))}
              </>
            )}

              {/* Commento AI + taccuino del coach (spec
                  docs/scheda_atleta_tooltip_e_commento.md §3): FRATELLI
                  dell'hero, non figli — per un corridore cpw è sempre null,
                  quindi vivere dentro il ramo cpw li farebbe sparire. Fuori
                  anche da `{profile && ...}`: un corridore puro non ha mai
                  profile_data, ma commento AI e taccuino devono comparire lo
                  stesso (gate esterno è `profile || hasRunnerProfile`). */}
              <div className="rounded-metric border border-border bg-surface px-6 py-5">
                {aiComment && (
                  <>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
                      {aiComment}
                    </p>
                    {aiCommentAt && (
                      <p className="mb-2 mt-1.5 text-[11px] text-faint">
                        Commento AI ·{" "}
                        {new Date(aiCommentAt).toLocaleDateString("it-IT")}
                      </p>
                    )}
                  </>
                )}
                <ExplainProfileButton
                  enabled={aiEnabled}
                  hasComment={aiComment != null}
                />

                {/* Taccuino del coach (Passo 5): le note che l'AI si è
                    segnata su di te — si accumulano nel tempo. */}
                {coachNotes.length > 0 && (
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted">
                      📝 Taccuino del coach
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {coachNotes.map((note) => (
                        <li
                          key={note.id}
                          className="text-[13px] leading-snug text-secondary"
                        >
                          <span className="text-faint">
                            {new Date(note.created_at).toLocaleDateString("it-IT")}{" "}
                            · {note.memory_type} ·
                          </span>{" "}
                          {note.nota}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

            {profile && (
              <>
              {/* W' + Pmax mini-cards */}
              {!isRunner && cpw && (
                <div className="grid grid-cols-2 gap-3">
                  <MiniCard
                    label="W′"
                    sublabel="Riserva anaerobica"
                    value={`${cpw.w_prime_kj.toFixed(1)} kJ`}
                    term="wprime"
                  />
                  <MiniCard
                    label="Pmax"
                    sublabel="Potenza massima"
                    value={cpw.p_max_w != null ? `${Math.round(cpw.p_max_w)} W` : "—"}
                  />
                </div>
              )}

              {/* RPP table */}
              {!isRunner && profile.rpp.length > 0 && (
                <div>
                  <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-muted">
                    Record Power Profile · {profile.meta.window_days}gg
                  </div>
                  <div className="overflow-hidden rounded-metric border border-border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-surface-2">
                          <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.1em] text-muted">
                            Durata
                          </th>
                          <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-[0.1em] text-muted">
                            Watt
                          </th>
                          <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-[0.1em] text-muted">
                            W/kg
                          </th>
                          <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-[0.1em] text-muted">
                            Aff.
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {RPP_DISPLAY.map(({ secs, label }) => {
                          const point = profile.rpp.find(
                            (e) => e.duration_s === secs
                          );
                          return (
                            <tr
                              key={secs}
                              className="border-b border-border bg-surface last:border-0"
                            >
                              <td className="px-4 py-3 font-medium text-foreground">
                                {label}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-foreground">
                                {point?.watts != null
                                  ? Math.round(point.watts)
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-secondary">
                                {point?.wkg != null ? point.wkg.toFixed(2) : "—"}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {point ? (
                                  point.exact ? (
                                    <span
                                      className="text-ready-go"
                                      title="Sforzo massimale registrato"
                                    >
                                      ●
                                    </span>
                                  ) : (
                                    <span
                                      className="text-ready-modify"
                                      title="Valore approssimato"
                                    >
                                      ◐
                                    </span>
                                  )
                                ) : (
                                  <span className="text-faint">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[11px] text-faint">
                    ● sforzo massimale · ◐ valore approssimato
                  </p>
                </div>
              )}
              </>
            )}

            </div>

        </>
      )}
    </>
  );
}

/**
 * Mostra il CP del modello power-law accanto a quello principale (Morton 3P)
 * SOLO quando i due divergono in modo percepibile (≥3%): sotto questa soglia
 * i modelli concordano e una seconda cifra confonderebbe. Spiega perché
 * strumenti come AnalyzeMe riportano una soglia diversa (vedi glossario
 * `cp_powerlaw`).
 */
function PowerLawCompare({
  cpw,
  powerLaw,
}: {
  cpw: ProfileTabsProps["cpw"];
  powerLaw: AthleteProfileData["cp_power_law"];
}) {
  if (!cpw || !powerLaw || cpw.cp_w <= 0) return null;
  const divergence = Math.abs(powerLaw.cp_w - cpw.cp_w) / cpw.cp_w;
  if (divergence < 0.03) return null;

  const higher = powerLaw.cp_w > cpw.cp_w;
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
      <span className="text-[10.5px] uppercase tracking-[0.12em] text-muted">
        Power-law
      </span>
      <span className="font-serif text-[18px] font-medium tabular-nums text-foreground">
        {Math.round(powerLaw.cp_w)} W
      </span>
      {powerLaw.cp_wkg != null && (
        <span className="text-[12px] text-muted">
          {powerLaw.cp_wkg.toFixed(2)} W/kg
        </span>
      )}
      <span
        className={`text-[12px] ${higher ? "text-ready-go" : "text-ready-modify"}`}
        aria-hidden
      >
        {higher ? "↗" : "↘"}
      </span>
      <InfoTooltip term="cp_powerlaw" />
    </div>
  );
}

function MiniCard({
  label,
  sublabel,
  value,
  term,
}: {
  label: string;
  sublabel: string;
  value: string;
  term?: string;
}) {
  return (
    <div className="rounded-metric border border-border bg-surface px-4 py-4">
      <div className="flex items-center gap-1.5">
        <span className="text-[10.5px] uppercase tracking-[0.12em] text-muted">
          {label}
        </span>
        {term && <InfoTooltip term={term} />}
      </div>
      <div className="mt-2 font-serif text-[24px] font-medium leading-none tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-faint">{sublabel}</div>
    </div>
  );
}
