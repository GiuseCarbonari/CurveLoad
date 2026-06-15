import { InfoTooltip } from "@/components/profile/info-tooltip";
import type {
  ClimbDemand,
  GapAnalysisResult,
  Limiter,
  Severity,
} from "@/lib/terrain/gap-analysis";
import type { CourseCharacter, TerrainSummary } from "@/lib/terrain/gpx-parser";

/**
 * Sezione "Analisi evento" di /profile (M5, PRD §33 C.6) — server component,
 * pura presentazione dei dati salvati (gap_analysis + event_terrain). Profilo
 * altimetrico in SVG puro (niente librerie), tabella salite, card limitatori.
 * Le stime sono etichettate come tali ("~", "stimata") — regola ferma.
 */

export interface SavedGapAnalysis extends GapAnalysisResult {
  event: {
    id: number | string | null;
    name: string | null;
    start_date_local: string | null;
    distance_km: number | null;
  };
}

const COURSE_CHARACTER: Record<
  CourseCharacter,
  { label: string; classes: string }
> = {
  flat: { label: "Pianeggiante", classes: "border-border bg-surface-2 text-secondary" },
  rolling: { label: "Ondulato", classes: "border-border bg-surface-2 text-secondary" },
  hilly: { label: "Collinare", classes: "border-border bg-surface-2 text-amber" },
  mountain: { label: "Montagnoso", classes: "border-border bg-surface-2 text-amber" },
};

const SEVERITY_BADGE: Record<Severity, { label: string; classes: string }> = {
  high: { label: "alta", classes: "text-ready-skip" },
  medium: { label: "media", classes: "text-ready-modify" },
  low: { label: "bassa", classes: "text-ready-go" },
};

const LEVER_LABELS: Record<string, string> = {
  durability_fatigued: "Durabilità (tenuta a fatica)",
  threshold_long: "Soglia lunga",
  sweet_spot_long: "Sweet Spot lunghi",
  wprime_reconstitution: "Ricostituzione W′",
  neuromuscular: "Neuromuscolare / sprint",
};

const FATIGUE_LABELS: Record<string, string> = {
  fresh: "fresco",
  moderate: "fatica moderata",
  fatigued: "a fatica",
};

const CATEGORY_LABELS: Record<string, string> = {
  HC: "HC",
  "Cat 1": "Cat 1",
  "Cat 2": "Cat 2",
  "Cat 3": "Cat 3",
  "Cat 4": "Cat 4",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.slice(0, 10));
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("it-IT", {
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

// --- Profilo altimetrico SVG -------------------------------------------------

const SVG_W = 1000;
const SVG_H = 200;

function ElevationProfile({ terrain }: { terrain: TerrainSummary }) {
  const poly = terrain.polyline;
  if (poly.length < 2) {
    return (
      <p className="text-sm text-muted">
        Profilo altimetrico non disponibile (percorso troppo corto).
      </p>
    );
  }

  const maxKm = poly[poly.length - 1][0] || terrain.total_distance_km || 1;
  const eles = poly.map((p) => p[3]);
  const minEle = Math.min(...eles);
  const maxEle = Math.max(...eles);
  const eleRange = maxEle - minEle || 1;

  const x = (km: number) => (km / maxKm) * SVG_W;
  const y = (ele: number) => SVG_H - ((ele - minEle) / eleRange) * SVG_H;

  const linePath = poly
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p[0]).toFixed(1)} ${y(p[3]).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${SVG_W} ${SVG_H} L 0 ${SVG_H} Z`;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
      className="h-32 w-full"
      role="img"
      aria-label="Profilo altimetrico del percorso con le salite rilevate"
    >
      {/* Salite rilevate: bande evidenziate */}
      {terrain.climbs.map((climb, i) => {
        const x0 = x(climb.position_km);
        const x1 = x(climb.position_km + climb.distance_km);
        return (
          <rect
            key={i}
            x={x0}
            y={0}
            width={Math.max(1, x1 - x0)}
            height={SVG_H}
            fill="var(--ready-modify)"
            opacity={0.13}
          />
        );
      })}
      {/* Area + linea di elevazione */}
      <path d={areaPath} fill="var(--amber)" opacity={0.12} />
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

// --- Componente principale ---------------------------------------------------

export function EventAnalysis({
  terrain,
  analysis,
  generatedAt,
}: {
  terrain: TerrainSummary;
  analysis: SavedGapAnalysis;
  generatedAt: string | null;
}) {
  const course = COURSE_CHARACTER[terrain.course_character];
  // Join salita (geometria) ↔ domanda (stime) per indice.
  const demandByIndex: Record<number, ClimbDemand | undefined> = {};
  analysis.climb_demands.forEach((d, i) => {
    demandByIndex[i] = d;
  });

  return (
    <section className="panel">
      <h2 className="panel-title">Analisi evento</h2>

      {/* a) Header evento */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">
          {analysis.event.name ?? "Gara"} · {formatDate(analysis.event.start_date_local)}{" "}
          · {analysis.event.distance_km ?? terrain.total_distance_km} km ·{" "}
          {terrain.total_elevation_m} m D+
        </p>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${course.classes}`}
        >
          {course.label} · {terrain.elevation_per_km} m/km
        </span>
      </div>

      {analysis.note && (
        <p className="mt-2 text-xs text-amber">{analysis.note}</p>
      )}

      {/* b) Profilo altimetrico SVG */}
      <div className="mt-4">
        <ElevationProfile terrain={terrain} />
        <p className="mt-1 text-xs text-muted">
          Bande ambra = salite rilevate. Profilo dalla polyline del GPX.
        </p>
      </div>

      {/* c) Tabella salite rilevate */}
      {terrain.climbs.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-[0.06em] text-muted">
                <th className="py-2">Pos. km</th>
                <th className="py-2 text-right">Lungh.</th>
                <th className="py-2 text-right">D+</th>
                <th className="py-2 text-right">Pend. media</th>
                <th className="py-2 text-right">Cat.</th>
                <th className="py-2 text-right">
                  <span className="inline-flex items-center gap-1">
                    Durata stim. <InfoTooltip term="fatica_stimata" />
                  </span>
                </th>
                <th className="py-2 text-right">Fatica al punto</th>
              </tr>
            </thead>
            <tbody>
              {terrain.climbs.map((climb, i) => {
                const demand = demandByIndex[i];
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">{climb.position_km}</td>
                    <td className="py-2 text-right">{climb.distance_km} km</td>
                    <td className="py-2 text-right">{climb.elevation_m} m</td>
                    <td className="py-2 text-right">
                      {climb.avg_gradient_pct}%
                      {climb.max_gradient_pct >= 8 && (
                        <span
                          className="cursor-help text-amber"
                          title={`Pitch ripido: max ~${climb.max_gradient_pct}% (scala attenuata)`}
                        >
                          {" "}
                          ▲
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {climb.category ? CATEGORY_LABELS[climb.category] : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {formatDuration(demand?.est_duration_s ?? null)}
                    </td>
                    <td className="py-2 text-right">
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

      {/* d) Card limitatori */}
      <div className="mt-6">
        <h3 className="panel-title flex items-center gap-1.5">
          Limitatori per questa gara
          <InfoTooltip term="limitatore" />
        </h3>
        {analysis.limiters.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Nessun limitatore rilevato (o dati insufficienti per il confronto).
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {analysis.limiters.map((limiter, i) => (
              <LimiterCard key={i} limiter={limiter} />
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs italic text-muted">
        Durate e fatica sono stime deterministiche dai tuoi dati (CP, RPP, peso,
        CTL) — non misure. Soglie di categoria e pendenza come Section 11.
        {generatedAt &&
          ` · Analizzato il ${new Date(generatedAt).toLocaleDateString("it-IT")}`}
      </p>
    </section>
  );
}

function LimiterCard({ limiter }: { limiter: Limiter }) {
  const badge = SEVERITY_BADGE[limiter.severity];
  const lever = LEVER_LABELS[limiter.training_lever] ?? limiter.training_lever;
  const isDurability = limiter.training_lever === "durability_fatigued";

  // Limitatore aggregato (più salite) vs singolo: etichetta dei km coinvolti.
  const refs = limiter.climb_refs ?? [limiter.climb_ref];
  const kmLabel =
    refs.length > 1
      ? `salite ai km ${refs.join(", ")}`
      : `salita al km ${refs[0]}`;

  return (
    <li className="rounded-[11px] border border-border bg-surface-2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          {limiter.name}
          {isDurability && <InfoTooltip term="durabilita" />}
        </p>
        <span className={`shrink-0 text-xs ${badge.classes}`}>
          severità {badge.label}
        </span>
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-secondary">
        {limiter.evidence}
        {limiter.required_wkg != null && <InfoTooltip term="wkg_richiesto" />}
        <span className="text-xs">· {kmLabel}</span>
      </p>

      <p className="mt-2 flex flex-wrap items-center gap-1 text-sm">
        <span className="font-medium">Lavora su:</span> {lever}
        <InfoTooltip term="leva" />
        {limiter.workout_library_refs.length > 0 && (
          <span className="text-xs text-muted">
            ({limiter.workout_library_refs.join(" · ")})
          </span>
        )}
      </p>
    </li>
  );
}
