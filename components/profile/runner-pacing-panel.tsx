"use client";

import Link from "next/link";

import {
  formatPace,
  paceZones,
  predictRaceTimes,
  type RunnerProfileData,
} from "@/lib/profile/pace-profile";
import {
  buildRiegelSummary,
  type RaceResult,
  type RiegelPrediction,
} from "@/lib/profile/riegel";
import { formatRaceTime } from "@/lib/profile/race-time";

/**
 * Pannello "Passo e previsioni" per chi corre: sostituisce mappa + messaggio
 * onesto in /terrain (route-card-stack.tsx), non è una card in più nel
 * profilo. Due motori fianco a fianco, MAI fusi in un'unica tabella (domini
 * di validità diversi):
 * - CS/D′ (pace-profile.ts): dalla curva di ALLENAMENTO, 1-15km.
 * - Riegel (riegel.ts): da RISULTATI DI GARA reali, 5-42km, l'unico che
 *   copre mezza/maratona.
 * Se concordano su una stessa distanza entro l'8%, meglio; se divergono di
 * più lo diciamo esplicitamente invece di sceglierne uno (No Virtual Math).
 */

const DIVERGENCE_THRESHOLD_PCT = 8;

function csdTimeForKm(
  predictions: ReturnType<typeof predictRaceTimes>,
  targetKm: number
): number | null {
  const match = predictions.find((p) => Math.abs(p.distance_m / 1000 - targetKm) < 0.01);
  return match?.time_s ?? null;
}

function divergencePct(a: number, b: number): number {
  return (Math.abs(a - b) / a) * 100;
}

export function RunnerPacingPanel({
  runner,
  races,
}: {
  runner: RunnerProfileData | null;
  races: RaceResult[];
}) {
  const csd = runner?.cs_dprime ?? null;
  const zones = paceZones(csd);
  const csdPredictions = predictRaceTimes(csd);
  const riegel = buildRiegelSummary(races);

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-metric border border-border bg-surface px-5 py-5">
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted">
          Zone e predizioni · da allenamento
        </div>
        <p className="mt-1.5 text-[12.5px] text-secondary">
          Dalla tua curva di allenamento (Critical Speed), valido 1-15 km.
        </p>

        {csd == null ? (
          <p className="mt-3 text-sm text-muted">
            Servono sforzi di corsa tra 2 e 15 minuti per calcolare le zone e
            le predizioni.
          </p>
        ) : (
          <>
            {zones.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[10px] uppercase tracking-[0.1em] text-faint">
                  Zone di passo
                </div>
                <div className="overflow-hidden rounded-metric border border-border">
                  <table className="w-full">
                    <tbody>
                      {zones.map((zone) => (
                        <tr
                          key={zone.key}
                          className="border-b border-border bg-surface last:border-0"
                        >
                          <td className="px-4 py-2.5 text-sm font-medium text-foreground">
                            {zone.key} · {zone.label}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm tabular-nums text-foreground">
                            {formatPace(zone.pace_s_per_km_slow)}–
                            {formatPace(zone.pace_s_per_km_fast)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {csdPredictions.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[10px] uppercase tracking-[0.1em] text-faint">
                  Predizioni
                </div>
                <div className="overflow-hidden rounded-metric border border-border">
                  <table className="w-full">
                    <tbody>
                      {csdPredictions.map((p) => (
                        <tr
                          key={p.distance_m}
                          className="border-b border-border bg-surface last:border-0"
                        >
                          <td className="px-4 py-2.5 text-sm font-medium text-foreground">
                            {p.label}
                            {!p.in_model_window && (
                              <span className="ml-1.5 text-ready-modify" title="Stima ottimista: oltre la finestra del modello">◐</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm tabular-nums text-foreground">
                            {formatPace(p.time_s)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-metric border border-border bg-surface px-5 py-5">
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted">
          Previsioni · da gare reali (Riegel)
        </div>
        <p className="mt-1.5 text-[12.5px] text-secondary">
          Da un tuo risultato di gara vero, valido fino a ~230 min — l&apos;unico
          che copre mezza e maratona. Oltre quella finestra è un tetto
          teorico, non un obiettivo.
        </p>

        {riegel.baseRace == null ? (
          <p className="mt-3 text-sm text-muted">
            Nessuna gara registrata.{" "}
            <Link href="/settings/profile" className="underline hover:text-foreground">
              Aggiungine una in Impostazioni
            </Link>{" "}
            per sbloccare questa previsione.
          </p>
        ) : (
          <>
            <p className="mt-3 text-[12px] text-faint">
              Base: {riegel.baseRace.distanza_km} km in{" "}
              {formatRaceTime(riegel.baseRace.tempo_finale_s)} (
              {new Date(`${riegel.baseRace.data}T00:00:00`).toLocaleDateString("it-IT")}
              {riegel.baseRace.livello_preparazione === "sottopreparato" &&
                " · sottopreparato, dato dichiarato"}
              )
            </p>

            {riegel.personalK == null ? (
              <p className="mt-2 text-[12px] text-faint">
                Con una sola gara hai solo la previsione standard (k=1.06).
                Registra una seconda gara su una distanza ben diversa per
                sbloccare il tuo esponente personale.
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-faint">
                Il tuo esponente personale è {riegel.personalK.k.toFixed(3)}
                {riegel.personalK.kMin != null &&
                  riegel.personalK.kMax != null &&
                  ` (range ${riegel.personalK.kMin.toFixed(3)}–${riegel.personalK.kMax.toFixed(3)} su ${riegel.personalK.pairsUsed} coppie)`}
                {riegel.personalK.k < 1.06
                  ? " — reggi il passo meglio della media man mano che la distanza cresce."
                  : riegel.personalK.k > 1.06
                    ? " — cedi più della media man mano che la distanza cresce."
                    : " — nella media."}{" "}
                Riflette anche quanto eri allenato/pacato in ogni gara, non
                solo la fisiologia.
              </p>
            )}

            <div className="mt-3 overflow-hidden rounded-metric border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-2">
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.1em] text-muted">
                      Distanza
                    </th>
                    <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-[0.1em] text-muted">
                      Standard
                    </th>
                    {riegel.personalK != null && (
                      <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-[0.1em] text-muted">
                        Personale
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {riegel.standard.map((p, i) => {
                    const personal = riegel.personal[i] as RiegelPrediction | undefined;
                    const csdTime = csdTimeForKm(csdPredictions, p.targetDistanceKm);
                    const diverges =
                      csdTime != null && divergencePct(csdTime, p.predictedTimeSeconds) > DIVERGENCE_THRESHOLD_PCT;
                    return (
                      <tr
                        key={p.targetDistanceKm}
                        className="border-b border-border bg-surface last:border-0"
                      >
                        <td className="px-4 py-2.5 text-sm font-medium text-foreground">
                          {p.targetDistanceKm === 21.0975
                            ? "Mezza"
                            : p.targetDistanceKm === 42.195
                              ? "Maratona"
                              : `${p.targetDistanceKm} km`}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm tabular-nums text-foreground">
                          {formatRaceTime(p.predictedTimeSeconds)}
                          {p.extrapolated && (
                            <span className="ml-1 text-ready-modify" title="Oltre la finestra di calibrazione Riegel (~230 min): tetto teorico, non obiettivo">◐</span>
                          )}
                          {diverges && (
                            <span className="ml-1 text-ready-modify" title={`Diverge di oltre l'${DIVERGENCE_THRESHOLD_PCT}% dalla stima da allenamento (CS/D′): ${formatPace(csdTime)}`}>⚠</span>
                          )}
                        </td>
                        {riegel.personalK != null && (
                          <td className="px-4 py-2.5 text-right text-sm tabular-nums text-foreground">
                            {personal ? (
                              <>
                                {formatRaceTime(personal.predictedTimeSeconds)}
                                {personal.extrapolated && (
                                  <span className="ml-1 text-ready-modify" title="Oltre la finestra di calibrazione Riegel (~230 min): tetto teorico, non obiettivo">◐</span>
                                )}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-faint">
              ◐ oltre la finestra di calibrazione (tetto, non obiettivo) · ⚠
              diverge dalla stima da allenamento
            </p>
          </>
        )}
      </section>
    </div>
  );
}
