"use client";

import { useEffect, useState } from "react";

import { InfoTooltip } from "@/components/profile/info-tooltip";
import { RouteMapLazy } from "@/components/profile/route-map-lazy";
import type { ClimbDemand } from "@/lib/terrain/gap-analysis";
import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import { cn } from "@/lib/utils";

/**
 * Card "Mappa" del route card-stack (M9 card-stack): mappa a piena altezza +
 * bottom-sheet con la tabella salite (peek/espansa). Selezione salita ↔
 * mappa è stato locale a questa card (non serve condividerlo con le altre
 * card, vedi spec). Tabella/colonne/helper copiati da event-analysis.tsx
 * (Pos./Lung./D+/Cat./Pendenza/Durata/Fatica), non ri-derivati.
 */

function formatDuration(secs: number | null): string {
  if (secs == null) return "—";
  if (secs < 60) return `~${secs}s`;
  return `~${Math.round(secs / 60)} min`;
}

function climbRowStyle(avgGradientPct: number) {
  if (avgGradientPct < 5) {
    return { rowBg: "bg-blue-950/10", dot: "text-blue-300", dotColor: "bg-blue-400" };
  }
  if (avgGradientPct < 8) {
    return { rowBg: "bg-amber-950/10", dot: "text-amber-300", dotColor: "bg-amber-400" };
  }
  return { rowBg: "bg-red-950/10", dot: "text-red-300", dotColor: "bg-red-400" };
}

function FatigueChip({ level }: { level: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    fresh: { label: "fresco", classes: "text-ready-go" },
    moderate: { label: "moderata", classes: "text-ready-modify" },
    fatigued: { label: "a fatica", classes: "text-ready-skip" },
  };
  const chip = map[level] ?? { label: level, classes: "text-muted" };
  return <span className={`text-xs font-medium ${chip.classes}`}>{chip.label}</span>;
}

export function RouteMapCard({
  terrain,
  demands,
}: {
  terrain: TerrainSummary;
  demands: Record<number, ClimbDemand | undefined>;
}) {
  const [selectedClimb, setSelectedClimb] = useState<number | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  // Nuova analisi -> reset selezione (edge case: indice potrebbe non
  // riferirsi più a una salita esistente nel nuovo terrain).
  useEffect(() => {
    setSelectedClimb(null);
  }, [terrain]);

  function selectClimb(idx: number | null) {
    setSelectedClimb(idx);
    if (idx != null) setSheetExpanded(true);
  }

  const hasClimbs = terrain.climbs.length > 0;

  return (
    <div className="relative h-[calc(100dvh-13.5rem)] min-h-[320px] w-full overflow-hidden rounded-2xl border border-border bg-surface sm:h-[calc(100dvh-14.5rem)]">
      <RouteMapLazy
        terrain={terrain}
        selectedClimb={selectedClimb}
        onSelectClimb={selectClimb}
        heightClass="h-full"
      />

      {/* Bottom sheet: peek (grab handle + riepilogo) oppure espanso (tabella scrollabile). */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.18)] transition-[max-height]",
          sheetExpanded ? "max-h-[65%]" : "max-h-[3.25rem]"
        )}
      >
        <button
          type="button"
          onClick={() => setSheetExpanded((v) => !v)}
          aria-expanded={sheetExpanded}
          className="flex min-h-10 w-full flex-col items-center gap-1 py-2"
        >
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden />
          <span className="text-xs font-medium text-secondary">
            {hasClimbs
              ? `${terrain.climbs.length} salite rilevate`
              : "Nessuna salita rilevata"}
          </span>
        </button>

        {sheetExpanded && (
          <div className="max-h-[calc(65dvh-2.5rem)] overflow-y-auto px-3 pb-3">
            {hasClimbs ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-muted">
                    <th className="pb-2.5">Pos.</th>
                    <th className="pb-2.5 text-right">Lung. · D+</th>
                    <th className="pb-2.5 text-right">Pend. · Cat.</th>
                    <th className="pb-2.5 text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        Durata <InfoTooltip term="fatica_stimata" />
                      </span>
                    </th>
                    <th className="pb-2.5 text-right">Fatica</th>
                  </tr>
                </thead>
                <tbody>
                  {terrain.climbs.map((climb, index) => {
                    const demand = demands[index];
                    const { rowBg, dot, dotColor } = climbRowStyle(climb.avg_gradient_pct);
                    const active = selectedClimb === index;
                    return (
                      <tr
                        key={index}
                        onClick={() => selectClimb(active ? null : index)}
                        className={cn(
                          "cursor-pointer border-b border-border last:border-0",
                          rowBg,
                          active && "ring-1 ring-inset ring-amber"
                        )}
                      >
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} aria-hidden />
                            <span className="tabular-nums text-foreground">{climb.position_km} km</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-foreground">
                          {climb.distance_km} km
                          <span className="ml-1 text-muted">· {climb.elevation_m} m</span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          <span className={dot}>{climb.avg_gradient_pct}%</span>
                          <span className="ml-1 text-muted">· {climb.category ?? "—"}</span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-secondary">
                          {formatDuration(demand?.est_duration_s ?? null)}
                        </td>
                        <td className="py-2.5 text-right">
                          {demand ? (
                            <FatigueChip level={demand.fatigue_level} />
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="py-4 text-center text-sm text-muted">
                Nessuna salita rilevata su questo percorso.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
