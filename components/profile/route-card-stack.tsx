"use client";

import { useState } from "react";

import { CalibrateButton } from "@/components/profile/calibrate-button";
import { CalibrationHelp } from "@/components/profile/calibration-help";
import { GapAnalysisButton } from "@/components/profile/gap-analysis-button";
import { InfoTooltip } from "@/components/profile/info-tooltip";
import { RaceEstimateView } from "@/components/profile/race-estimate";
import { RouteMapCard } from "@/components/profile/route-map-card";
import { BikeStrategyForm, RepeatabilityForm } from "@/components/profile/route-settings-form";
import type {
  ClimbDemand,
  GapAnalysisResult,
  Limiter,
  Severity,
} from "@/lib/terrain/gap-analysis";
import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import type { RaceEstimateV2 } from "@/lib/terrain/race-estimator-v2";
import type { RaceRouteSettings } from "@/lib/terrain/route-settings";
import { cn } from "@/lib/utils";

/**
 * Card-stack full-screen della pagina percorso (M9): un header fisso compatto
 * (titolo + tab) e una sola card visibile alla volta (Mappa / Limitatori /
 * Stima). Riceve tutti i dati come prop dal server component (app/terrain/
 * page.tsx resta l'unica fonte dati). Nessuna libreria nuova: tab = stato
 * React, card = render condizionale semplice (nessuna animazione richiesta).
 */

export interface SavedGapAnalysis extends GapAnalysisResult {
  event: {
    id: number | string | null;
    name: string | null;
    start_date_local: string | null;
    distance_km: number | null;
  };
}

type Tab = "map" | "limiters" | "estimate";
type EstimateStep = "strategy" | "repeatability" | "results";

const SEVERITY_BADGE: Record<Severity, { label: string; classes: string }> = {
  high: { label: "alta", classes: "text-ready-skip" },
  medium: { label: "media", classes: "text-ready-modify" },
  low: { label: "bassa", classes: "text-ready-go" },
};

const SEVERITY_ORDER: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const LEVER_LABELS: Record<string, string> = {
  durability_fatigued: "Durabilità a fatica",
  threshold_long: "Soglia lunga",
  sweet_spot_long: "Sweet Spot lunghi",
  wprime_reconstitution: "Ricostituzione W′",
  neuromuscular: "Neuromuscolare e sprint",
};

const TABS: { key: Tab; label: string }[] = [
  { key: "map", label: "Mappa" },
  { key: "limiters", label: "Limitatori" },
  { key: "estimate", label: "Stima" },
];

const ESTIMATE_STEPS: { key: EstimateStep; label: string }[] = [
  { key: "strategy", label: "Bici e strategia" },
  { key: "repeatability", label: "Margine" },
  { key: "results", label: "Stima" },
];

function SubTabs<T extends string>({
  steps,
  active,
  onChange,
}: {
  steps: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="flex gap-3 border-b border-border text-xs">
      {steps.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          className={cn(
            "min-h-8 flex-1 border-b-2 px-2 py-1.5 transition-colors",
            active === s.key
              ? "border-accent2 font-medium text-accent2"
              : "border-transparent text-muted hover:text-foreground"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function RouteCardStack({
  terrain,
  analysis,
  gapGeneratedAt,
  estimate,
  estimateGeneratedAt,
  signatureLevel,
  routeSettings,
}: {
  terrain: TerrainSummary | null;
  analysis: SavedGapAnalysis | null;
  gapGeneratedAt: string | null;
  estimate: RaceEstimateV2 | null;
  estimateGeneratedAt: string | null;
  signatureLevel: 1 | 2 | null;
  routeSettings: RaceRouteSettings;
}) {
  const [tab, setTab] = useState<Tab>("map");

  const hasAnalysis = terrain != null && analysis != null;

  if (!hasAnalysis) {
    return (
      <div className="space-y-4">
        <Header analysis={null} terrain={null} hasAnalysis={false} />
        <div className="rounded-[16px] border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          Seleziona una gara da Intervals.icu o carica un GPX per vedere il
          profilo altimetrico e i limitatori specifici.
        </div>
      </div>
    );
  }

  const demands: Record<number, ClimbDemand | undefined> = {};
  analysis.climb_demands.forEach((demand, index) => {
    demands[index] = demand;
  });

  return (
    <div className="flex flex-col gap-3">
      <Header analysis={analysis} terrain={terrain} hasAnalysis />

      <div className="flex gap-1 rounded-[11px] bg-base p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "min-h-10 flex-1 rounded-[9px] px-2 py-1 transition-colors",
              tab === t.key
                ? "bg-brand font-medium text-brand-on shadow-sm"
                : "text-muted hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "map" && <RouteMapCard terrain={terrain} demands={demands} />}

      {tab === "limiters" && (
        <LimitersCard analysis={analysis} generatedAt={gapGeneratedAt} />
      )}

      {tab === "estimate" && (
        <EstimateCard
          terrain={terrain}
          estimate={estimate}
          estimateGeneratedAt={estimateGeneratedAt}
          signatureLevel={signatureLevel}
          routeSettings={routeSettings}
        />
      )}
    </div>
  );
}

function Header({
  analysis,
  terrain,
  hasAnalysis,
}: {
  analysis: SavedGapAnalysis | null;
  terrain: TerrainSummary | null;
  hasAnalysis: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-base pb-1 pt-1">
      <div className="min-w-0">
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-accent2">
          Analisi evento
        </div>
        {hasAnalysis && analysis && terrain ? (
          <h2 className="mt-0.5 truncate font-serif text-base text-foreground sm:text-lg">
            {analysis.event.name ?? "Gara target"}
            <span className="ml-2 text-xs font-sans font-normal text-secondary">
              {analysis.event.distance_km ?? terrain.total_distance_km} km ·{" "}
              {terrain.total_elevation_m} m D+
            </span>
          </h2>
        ) : (
          <h2 className="mt-1 font-serif text-[22px] text-foreground">
            Richieste del percorso
          </h2>
        )}
      </div>
      <div className="shrink-0">
        <GapAnalysisButton hasAnalysis={hasAnalysis} />
      </div>
    </div>
  );
}

function LimitersCard({
  analysis,
  generatedAt,
}: {
  analysis: SavedGapAnalysis;
  generatedAt: string | null;
}) {
  const limiters = [...analysis.limiters].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <h3 className="flex items-center gap-1.5 text-base font-medium text-foreground">
        Limitatori per questa gara
        <InfoTooltip term="limitatore" />
      </h3>
      {analysis.note && (
        <p className="mt-3 text-sm leading-6 text-secondary">{analysis.note}</p>
      )}
      {limiters.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          Nessun limitatore rilevato, oppure dati insufficienti per il
          confronto.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {limiters.map((limiter, index) => (
            <LimiterRow key={index} limiter={limiter} />
          ))}
        </ul>
      )}

      <details className="mt-5 border-t border-border pt-4 text-xs text-muted">
        <summary className="min-h-10 cursor-pointer py-2 font-medium text-secondary">
          Metodo e qualità della stima
        </summary>
        <p className="pb-2 leading-5">
          Durate e fatica sono stime deterministiche costruite da CP, RPP,
          peso e CTL, non misure dirette.
          {generatedAt &&
            ` Analisi aggiornata il ${new Date(generatedAt).toLocaleDateString("it-IT")}.`}
        </p>
      </details>
    </section>
  );
}

function LimiterRow({ limiter }: { limiter: Limiter }) {
  const badge = SEVERITY_BADGE[limiter.severity];
  const lever = LEVER_LABELS[limiter.training_lever] ?? limiter.training_lever;
  const refs = limiter.climb_refs ?? [limiter.climb_ref];
  const reference =
    refs.length > 1 ? `salite ai km ${refs.join(", ")}` : `salita al km ${refs[0]}`;

  return (
    <li className="py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          {limiter.name}
          {limiter.training_lever === "durability_fatigued" && (
            <InfoTooltip term="durabilita" />
          )}
        </p>
        <span className={`shrink-0 text-xs ${badge.classes}`}>
          severità {badge.label}
        </span>
      </div>
      <p className="mt-1 text-sm leading-6 text-secondary">
        {limiter.evidence} · {reference}
      </p>
      <p className="mt-2 text-sm text-foreground">
        <span className="text-muted">Leva di lavoro:</span> {lever}
        {limiter.workout_library_refs.length > 0 && (
          <span className="ml-1 text-xs text-faint">
            ({limiter.workout_library_refs.join(" · ")})
          </span>
        )}
      </p>
    </li>
  );
}

function EstimateCard({
  terrain,
  estimate,
  estimateGeneratedAt,
  signatureLevel,
  routeSettings,
}: {
  terrain: TerrainSummary;
  estimate: RaceEstimateV2 | null;
  estimateGeneratedAt: string | null;
  signatureLevel: 1 | 2 | null;
  routeSettings: RaceRouteSettings;
}) {
  const [step, setStep] = useState<EstimateStep>("strategy");

  return (
    <section className="space-y-3">
      <SubTabs steps={ESTIMATE_STEPS} active={step} onChange={setStep} />

      {step === "strategy" && (
        <BikeStrategyForm initialSettings={routeSettings} climbs={terrain.climbs} />
      )}

      {step === "repeatability" && (
        <RepeatabilityForm initialSettings={routeSettings} />
      )}

      {step === "results" && (
        <div className="space-y-4">
          <CalibrationHelp />

          {signatureLevel == null && (
            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-ready-skip-border bg-surface px-4 py-3.5">
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  Calibrazione assente
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  Adatta il modello alle tue uscite MTB recenti.
                </p>
              </div>
              <div className="shrink-0">
                <CalibrateButton label="Calibra" />
              </div>
            </div>
          )}

          {signatureLevel === 2 && (
            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-ready-modify-border bg-surface px-4 py-3.5">
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  Stima su valori medi MTB
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {estimate?.activities_used != null
                    ? `${estimate.activities_used} attività analizzate.`
                    : "Calibra per rendere la stima personale."}
                </p>
              </div>
              <div className="shrink-0">
                <CalibrateButton label="Migliora" variant="outline" />
              </div>
            </div>
          )}

          {signatureLevel === 1 && (
            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-ready-go-border bg-surface px-4 py-3.5">
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  Calibrata sui tuoi dati
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {estimate?.source_breakdown
                    ? `${estimate.source_breakdown.L1}% dati personali.`
                    : "Stima basata sulle tue uscite MTB."}
                </p>
              </div>
              <div className="shrink-0">
                <CalibrateButton label="Ricalibra" variant="outline" />
              </div>
            </div>
          )}

          {signatureLevel != null && estimate && (
            <>
              <RaceEstimateView
                terrain={terrain}
                estimate={estimate}
                generatedAt={estimateGeneratedAt}
              />
              {estimate.source_breakdown && (
                <p className="text-[11px] text-faint">
                  Copertura: L1 {estimate.source_breakdown.L1}% personale · L2{" "}
                  {estimate.source_breakdown.L2}% archetipo · L3{" "}
                  {estimate.source_breakdown.L3}% modello fisico.
                </p>
              )}
            </>
          )}

          {signatureLevel != null && !estimate && (
            <p className="rounded-[14px] border border-border bg-surface px-4 py-4 text-sm text-secondary">
              Firma pronta. Rianalizza l&apos;evento per generare la stima.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
