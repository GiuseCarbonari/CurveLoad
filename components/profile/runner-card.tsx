"use client";

import { InfoTooltip } from "./info-tooltip";
import {
  formatPace,
  paceZones,
  predictRaceTimes,
  type RunnerProfileData,
} from "@/lib/profile/pace-profile";

/** Le stesse 5 durate della tabellina RPP bici, per la corsa (§6). */
const RPP_DISPLAY: Array<{ secs: number; label: string }> = [
  { secs: 60, label: "1 min" },
  { secs: 300, label: "5 min" },
  { secs: 600, label: "10 min" },
  { secs: 1200, label: "20 min" },
  { secs: 3600, label: "60 min" },
];

interface RunnerCardProps {
  runner: RunnerProfileData | null;
}

/**
 * Card "Corsa · Velocità critica" (Passo 9). Copia il guscio di
 * durability-card.tsx e la tipografia hero + pattern MiniCard/tabella RPP di
 * profile-tabs.tsx (decisione §6: duplicare 15 righe costa meno di un
 * refactor condiviso).
 *
 * `runner == null` → null: chi non corre non vede nulla di nuovo, zero
 * routing per sport (decisione §1.1, fuori scope Passo 10).
 */
export function RunnerCard({ runner }: RunnerCardProps) {
  if (runner == null) return null;

  const csd = runner.cs_dprime;
  const zones = paceZones(csd);
  const predictions = predictRaceTimes(csd);

  return (
    <div className="rounded-metric border border-border bg-surface px-5 py-5">
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted">
          Corsa · Velocità critica
        </span>
        <InfoTooltip term="cs" />
      </div>

      {csd ? (
        <>
          <div className="mt-1.5 flex items-end gap-2.5">
            <span className="font-serif text-[58px] font-medium leading-none tabular-nums text-foreground">
              {formatPace(csd.cs_pace_s_per_km)}
            </span>
            <span className="mb-2 font-serif text-[22px] text-secondary">
              /km
            </span>
            <span className="mb-2 text-[14px] text-muted">
              {csd.cs_mps.toFixed(2)} m/s
            </span>
          </div>

          <div className="mt-3">
            <MiniCard
              label="D′"
              sublabel="Riserva di distanza"
              value={`${csd.d_prime_m} m`}
              term="dprime"
            />
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Servono sforzi di corsa tra 2 e 15 minuti per calcolare la velocità
          critica.
        </p>
      )}

      {/* Tabella Record Pace Profile */}
      <div className="mt-4">
        <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-muted">
          Record Pace Profile
        </div>
        <div className="overflow-hidden rounded-metric border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.1em] text-muted">
                  Durata
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-[0.1em] text-muted">
                  Passo
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-[0.1em] text-muted">
                  Aff.
                </th>
              </tr>
            </thead>
            <tbody>
              {RPP_DISPLAY.map(({ secs, label }) => {
                const point = runner.rpp.find((e) => e.duration_s === secs);
                return (
                  <tr
                    key={secs}
                    className="border-b border-border bg-surface last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {label}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatPace(point?.pace_s_per_km ?? null)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {point && point.pace_s_per_km != null ? (
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

      {/* Zone di passo (Q5, v0) */}
      {zones.length > 0 && (
        <div className="mt-4">
          <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-muted">
            Zone di passo
          </div>
          <div className="overflow-hidden rounded-metric border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.1em] text-muted">
                    Zona
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-[0.1em] text-muted">
                    Passo da–a
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-[0.1em] text-muted">
                    % CS
                  </th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr
                    key={zone.key}
                    className="border-b border-border bg-surface last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {zone.key} · {zone.label}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatPace(zone.pace_s_per_km_slow)}–{formatPace(zone.pace_s_per_km_fast)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-secondary">
                      {zone.pct_cs_min === 0
                        ? `< ${zone.pct_cs_max}%`
                        : `${zone.pct_cs_min}–${zone.pct_cs_max}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Predizioni di gara (Q6): stima onesta, entro/oltre la finestra di fit */}
      {predictions.length > 0 && (
        <div className="mt-4">
          <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-muted">
            Predizioni
          </div>
          <div className="overflow-hidden rounded-metric border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.1em] text-muted">
                    Distanza
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-[0.1em] text-muted">
                    Tempo
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-[0.1em] text-muted">
                    Passo
                  </th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((prediction) => (
                  <tr
                    key={prediction.distance_m}
                    className="border-b border-border bg-surface last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {prediction.label}
                      {!prediction.in_model_window && (
                        <span
                          className="ml-1.5 text-ready-modify"
                          title="Stima ottimista: oltre la finestra del modello"
                        >
                          ◐
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatPace(prediction.time_s)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-secondary">
                      {formatPace(prediction.pace_s_per_km)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-faint">
            ◐ stima ottimista, fuori dal modello
          </p>
        </div>
      )}
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
