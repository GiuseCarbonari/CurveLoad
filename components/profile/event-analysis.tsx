import { InfoTooltip } from "@/components/profile/info-tooltip";
import type {
  ClimbDemand,
  GapAnalysisResult,
  Limiter,
  Severity,
} from "@/lib/terrain/gap-analysis";
import type { CourseCharacter, TerrainSummary } from "@/lib/terrain/gpx-parser";

export interface SavedGapAnalysis extends GapAnalysisResult {
  event: {
    id: number | string | null;
    name: string | null;
    start_date_local: string | null;
    distance_km: number | null;
  };
}

const COURSE_CHARACTER: Record<CourseCharacter, string> = {
  flat: "Pianeggiante",
  rolling: "Ondulato",
  hilly: "Collinare",
  mountain: "Montagnoso",
};

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

const FATIGUE_LABELS: Record<string, string> = {
  fresh: "fresco",
  moderate: "fatica moderata",
  fatigued: "a fatica",
};

function formatDate(iso: string | null): string {
  if (!iso) return "Data non disponibile";
  const date = new Date(iso.slice(0, 10));
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(secs: number | null): string {
  if (secs == null) return "—";
  if (secs < 60) return `~${secs}s`;
  return `~${Math.round(secs / 60)} min`;
}

const SVG_W = 1000;
const SVG_H = 200;

function ElevationProfile({ terrain }: { terrain: TerrainSummary }) {
  const polyline = terrain.polyline;
  if (polyline.length < 2) {
    return (
      <p className="px-3 py-10 text-sm text-muted">
        Profilo altimetrico non disponibile.
      </p>
    );
  }

  const maxKm =
    polyline[polyline.length - 1][0] || terrain.total_distance_km || 1;
  const elevations = polyline.map((point) => point[3]);
  const minElevation = Math.min(...elevations);
  const elevationRange = Math.max(...elevations) - minElevation || 1;
  const x = (km: number) => (km / maxKm) * SVG_W;
  const y = (elevation: number) =>
    SVG_H - ((elevation - minElevation) / elevationRange) * SVG_H;
  const linePath = polyline
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(point[0]).toFixed(1)} ${y(point[3]).toFixed(1)}`
    )
    .join(" ");
  const areaPath = `${linePath} L ${SVG_W} ${SVG_H} L 0 ${SVG_H} Z`;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
      className="h-44 w-full sm:h-52"
      role="img"
      aria-label="Profilo altimetrico del percorso con le salite rilevate"
    >
      {terrain.climbs.map((climb, index) => {
        const start = x(climb.position_km);
        const end = x(climb.position_km + climb.distance_km);
        return (
          <rect
            key={index}
            x={start}
            y={0}
            width={Math.max(1, end - start)}
            height={SVG_H}
            fill="var(--amber)"
            opacity={0.1}
          />
        );
      })}
      <path d={areaPath} fill="var(--amber)" opacity={0.1} />
      <path
        d={linePath}
        fill="none"
        stroke="var(--amber)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function EventAnalysis({
  terrain,
  analysis,
  generatedAt,
}: {
  terrain: TerrainSummary;
  analysis: SavedGapAnalysis;
  generatedAt: string | null;
}) {
  const demands: Record<number, ClimbDemand | undefined> = {};
  analysis.climb_demands.forEach((demand, index) => {
    demands[index] = demand;
  });
  const limiters = [...analysis.limiters].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-medium tracking-[-0.02em] text-foreground">
            {analysis.event.name ?? "Gara target"}
          </h3>
          <p className="mt-1 text-sm text-secondary">
            {formatDate(analysis.event.start_date_local)} ·{" "}
            {analysis.event.distance_km ?? terrain.total_distance_km} km ·{" "}
            {terrain.total_elevation_m} m D+
          </p>
        </div>
        <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-secondary">
          {COURSE_CHARACTER[terrain.course_character]} ·{" "}
          {terrain.elevation_per_km} m/km
        </span>
      </div>

      {analysis.note && (
        <p className="mt-3 text-sm leading-6 text-secondary">{analysis.note}</p>
      )}

      <div className="mt-6 overflow-hidden rounded-[11px] border border-border bg-base px-2 pt-3">
        <ElevationProfile terrain={terrain} />
        <p className="border-t border-border px-2 py-2 text-xs text-muted">
          Le bande ambra indicano le salite rilevate nel GPX.
        </p>
      </div>

      {terrain.climbs.length > 0 && (
        <div className="mt-7 overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-muted">
                <th className="py-3">Posizione</th>
                <th className="py-3 text-right">Lunghezza</th>
                <th className="py-3 text-right">D+</th>
                <th className="py-3 text-right">Pendenza</th>
                <th className="py-3 text-right">Categoria</th>
                <th className="py-3 text-right">
                  <span className="inline-flex items-center gap-1">
                    Durata stimata <InfoTooltip term="fatica_stimata" />
                  </span>
                </th>
                <th className="py-3 text-right">Fatica</th>
              </tr>
            </thead>
            <tbody>
              {terrain.climbs.map((climb, index) => {
                const demand = demands[index];
                return (
                  <tr
                    key={index}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-3">{climb.position_km} km</td>
                    <td className="py-3 text-right">{climb.distance_km} km</td>
                    <td className="py-3 text-right">{climb.elevation_m} m</td>
                    <td className="py-3 text-right">
                      {climb.avg_gradient_pct}%
                      {climb.max_gradient_pct >= 8 && (
                        <span
                          className="ml-1 cursor-help text-amber"
                          title={`Pendenza massima stimata: ${climb.max_gradient_pct}%`}
                        >
                          ripida
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {climb.category ?? "—"}
                    </td>
                    <td className="py-3 text-right">
                      {formatDuration(demand?.est_duration_s ?? null)}
                    </td>
                    <td className="py-3 text-right">
                      {demand ? FATIGUE_LABELS[demand.fatigue_level] : "—"}
                      {demand?.est_kjkg != null && (
                        <span className="text-xs text-muted">
                          {" "}
                          (~{demand.est_kjkg} kJ/kg)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-7">
        <h3 className="flex items-center gap-1.5 text-base font-medium text-foreground">
          Limitatori per questa gara
          <InfoTooltip term="limitatore" />
        </h3>
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
      </div>

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
