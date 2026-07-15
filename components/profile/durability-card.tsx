"use client";

import { DurabilityButton } from "./durability-button";
import { InfoTooltip } from "./info-tooltip";
import type { AthleteProfileData } from "@/lib/profile/build-profile";

/** Colore fatica, coerente con CHART_COLORS.atl in condition-trend-chart.tsx. */
const FATIGUE_COLOR = "#F58A7C";

const DURATION_LABEL: Record<number, string> = {
  60: "1 min",
  300: "5 min",
  1200: "20 min",
};

interface DurabilityCardProps {
  durability: AthleteProfileData["durability"] | null | undefined;
}

export function DurabilityCard({ durability }: DurabilityCardProps) {
  const hasData = durability != null && durability.confidence != null;

  return (
    <div className="rounded-[18px] border border-border bg-surface px-5 py-5">
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted">
          Durabilità
        </span>
        <InfoTooltip term="durabilita" />
      </div>

      {!hasData && (
        <div className="mt-4 text-center">
          <p className="text-sm text-muted">
            Non ancora calcolata. Serve qualche uscita lunga (≥90 min) con
            misuratore di potenza.
          </p>
          <div className="mt-3 flex justify-center">
            <DurabilityButton label="Calcola durabilità" />
          </div>
        </div>
      )}

      {hasData && <DurabilityContent durability={durability} />}
    </div>
  );
}

function DurabilityContent({
  durability,
}: {
  durability: NonNullable<AthleteProfileData["durability"]>;
}) {
  // Frase in italiano semplice: durata 20', ripiega su 5' poi 1' se il
  // decline è null (dati insufficienti su quella durata).
  const sentenceEntry =
    durability.decline.find((d) => d.duration_s === 1200 && d.decline_pct != null) ??
    durability.decline.find((d) => d.duration_s === 300 && d.decline_pct != null) ??
    durability.decline.find((d) => d.duration_s === 60 && d.decline_pct != null) ??
    null;

  const maxAbsPct = Math.max(
    0.01,
    ...durability.decline.map((d) => Math.abs(d.decline_pct ?? 0))
  );

  return (
    <>
      <div className="mt-1.5 flex items-end gap-2.5">
        <span className="font-serif text-[46px] font-medium leading-none tabular-nums text-foreground">
          {durability.durability_index ?? "—"}
        </span>
        <span className="mb-1.5 text-[13px] text-muted">Indice di durabilità</span>
      </div>

      {sentenceEntry && (
        <p className="mt-2 text-sm text-secondary">
          Dopo ~{Math.round(sentenceEntry.fatigued_bin_kj)} kJ la tua potenza sui{" "}
          {DURATION_LABEL[sentenceEntry.duration_s] ?? `${sentenceEntry.duration_s}s`} cala del{" "}
          {Math.abs(Math.round((sentenceEntry.decline_pct ?? 0) * 100))}%.
        </p>
      )}

      {/* Mini-grafico a barre: calo % per durata, sotto la linea 0. */}
      <div className="mt-4">
        <svg viewBox="0 0 180 90" className="block w-full max-w-[260px]">
          <line x1="10" y1="20" x2="170" y2="20" stroke="color-mix(in srgb, var(--foreground) 16%, transparent)" />
          {durability.decline.map((entry, index) => {
            const x = 30 + index * 55;
            const pct = entry.decline_pct ?? 0;
            const barHeight = pct < 0 ? (Math.abs(pct) / maxAbsPct) * 42 : 0;
            return (
              <g key={entry.duration_s}>
                <rect
                  x={x - 14}
                  y={20}
                  width={28}
                  height={barHeight}
                  fill={FATIGUE_COLOR}
                  opacity={entry.decline_pct == null ? 0.15 : 0.85}
                  rx={3}
                />
                <text
                  x={x}
                  y={74}
                  textAnchor="middle"
                  className="fill-secondary"
                  style={{ fontSize: 9 }}
                >
                  {entry.decline_pct != null ? `${Math.round(entry.decline_pct * 100)}%` : "—"}
                </text>
                <text
                  x={x}
                  y={86}
                  textAnchor="middle"
                  className="fill-muted"
                  style={{ fontSize: 9 }}
                >
                  {DURATION_LABEL[entry.duration_s] ?? `${entry.duration_s}s`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {durability.confidence === "low" && (
        <div className="mt-4 rounded-[14px] border border-l-[3px] border-ready-modify-border border-l-ready-modify bg-surface px-4 py-3 text-[13px] text-secondary">
          Confidenza bassa: poche uscite lunghe registrate. Il dato è
          indicativo.
        </div>
      )}
    </>
  );
}
