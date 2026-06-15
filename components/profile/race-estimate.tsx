import { InfoTooltip } from "@/components/profile/info-tooltip";
import type { CourseCharacter, TerrainSummary } from "@/lib/terrain/gpx-parser";
import type { RaceEstimate } from "@/lib/terrain/race-estimator";

/**
 * Sezione "Stima tempi gara" di /profile (M race-estimate, PRD §33) — server
 * component, pura presentazione di race_estimate + event_terrain salvati.
 * Tre scenari, split sulle salite principali, grafico pacing SVG (riusa lo
 * stile dell'altimetria), consigli di pacing, note metodologiche. Tutte
 * stime deterministiche, fonte dichiarata.
 */

const SVG_W = 1000;
const SVG_H = 200;

/** "Xh YYmin" da secondi. */
function formatHm(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}min`;
}

/** Categorie "principali" mostrate negli split (esclude Cat 4 e null). */
const MAIN_CATEGORIES = new Set(["HC", "Cat 1", "Cat 2", "Cat 3"]);

/** Scala neutra/ambra: la semaforica resta riservata agli stati funzionali. */
function speedColor(kmh: number): string {
  if (kmh < 6) return "var(--text-muted)";
  if (kmh < 12) return "var(--text-secondary)";
  return "var(--amber)";
}

const COURSE_LABEL: Record<CourseCharacter, string> = {
  flat: "pianeggiante",
  rolling: "ondulato",
  hilly: "collinare",
  mountain: "montagnoso",
};

// --- Grafico pacing: altimetria + velocità realistica colorata --------------

function PacingChart({
  terrain,
  estimate,
}: {
  terrain: TerrainSummary;
  estimate: RaceEstimate;
}) {
  const poly = terrain.polyline;
  const segments = estimate.scenarios.realistic.segments;
  if (poly.length < 2 || segments.length < 2) {
    return (
      <p className="text-sm text-muted">
        Grafico pacing non disponibile (traccia troppo corta).
      </p>
    );
  }

  const maxKm = poly[poly.length - 1][0] || terrain.total_distance_km || 1;
  const eles = poly.map((p) => p[3]);
  const minEle = Math.min(...eles);
  const eleRange = Math.max(...eles) - minEle || 1;

  const speeds = segments.map((s) => s.speed_kmh);
  const maxSpeed = Math.max(...speeds, 1);

  const x = (km: number) => (km / maxKm) * SVG_W;
  const yEle = (ele: number) => SVG_H - ((ele - minEle) / eleRange) * SVG_H;
  const ySpeed = (kmh: number) => SVG_H - (kmh / maxSpeed) * SVG_H;

  const elePath = poly
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p[0]).toFixed(1)} ${yEle(p[3]).toFixed(1)}`)
    .join(" ");
  const eleArea = `${elePath} L ${SVG_W} ${SVG_H} L 0 ${SVG_H} Z`;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
      className="h-32 w-full"
      role="img"
      aria-label="Profilo altimetrico con la velocità stimata per lo scenario realistico"
    >
      {/* Altimetria di sfondo (contesto) */}
      <path d={eleArea} fill="var(--amber)" opacity={0.08} />
      {/* Velocità realistica: segmenti colorati per fascia di velocità */}
      {segments.slice(0, -1).map((s, i) => {
        const next = segments[i + 1];
        return (
          <line
            key={i}
            x1={x(s.km)}
            y1={ySpeed(s.speed_kmh)}
            x2={x(next.km)}
            y2={ySpeed(next.speed_kmh)}
            stroke={speedColor(s.speed_kmh)}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

// --- Componente principale ---------------------------------------------------

export function RaceEstimateView({
  terrain,
  estimate,
  generatedAt,
}: {
  terrain: TerrainSummary;
  estimate: RaceEstimate;
  generatedAt: string | null;
}) {
  const { optimistic, realistic, conservative } = estimate.scenarios;
  const mainSplits = estimate.pacing.key_splits.filter(
    (s) => s.category != null && MAIN_CATEGORIES.has(s.category)
  );

  return (
    <section className="panel">
      <h2 className="panel-title">Stima tempi gara</h2>

      {/* a) Tre scenari */}
      <p className="mt-3 text-sm text-secondary">
        Punta all'«Obiettivo realistico». Gli altri due sono il caso migliore
        possibile e quello con imprevisti.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ScenarioCard
          label="Giornata perfetta"
          subtitle="se tutto va al meglio e non cali mai"
          time={formatHm(optimistic.total_seconds)}
          tooltip="giornata_perfetta"
        />
        <ScenarioCard
          label="Obiettivo realistico"
          subtitle="il tempo su cui puntare, gestendo bene"
          time={formatHm(realistic.total_seconds)}
          tooltip="obiettivo_realistico"
          highlight
        />
        <ScenarioCard
          label="Con imprevisti"
          subtitle="se la giornata è dura o ci sono soste"
          time={formatHm(conservative.total_seconds)}
          tooltip="con_imprevisti"
        />
      </div>
      <p className="mt-3 text-xs text-muted">
        Questi tempi si basano sulla tua forma attuale. Migliorando
        l'allenamento, l'obiettivo realistico scende. Si aggiorna
        automaticamente quando il tuo profilo cresce.
      </p>

      {estimate.pacing.warning && (
        <p className="mt-3 rounded-[11px] border border-border bg-amber-dim p-3 text-sm text-secondary">
          {estimate.pacing.warning}
        </p>
      )}

      {/* b) Split sulle salite principali */}
      {mainSplits.length > 0 && (
        <div className="mt-6">
          <h3 className="panel-title">
            Arrivo in cima alle salite principali (realistico)
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-[0.06em] text-muted">
                  <th className="py-2">Salita</th>
                  <th className="py-2 text-right">Km cima</th>
                  <th className="py-2 text-right">D+ · pend.</th>
                  <th className="py-2 text-right">Tempo arrivo</th>
                </tr>
              </thead>
              <tbody>
                {mainSplits.map((s, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">{s.category}</td>
                    <td className="py-2 text-right">{s.top_km}</td>
                    <td className="py-2 text-right">
                      {s.elevation_m} m · {s.avg_gradient_pct}%
                    </td>
                    <td className="py-2 text-right font-medium">
                      {s.eta_formatted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* c) Grafico pacing */}
      <div className="mt-6">
        <h3 className="panel-title">
          Velocità stimata sul percorso
        </h3>
        <div className="mt-2">
          <PacingChart terrain={terrain} estimate={estimate} />
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
            <span>
              <span className="text-amber">●</span> veloce
            </span>
            <span>
              <span className="text-secondary">●</span> lento
            </span>
            <span>
              <span className="text-muted">●</span> &lt; 6 km/h (salita ripida)
            </span>
          </p>
        </div>
      </div>

      {/* d) Come gestire il pacing */}
      <div className="mt-6">
        <h3 className="panel-title">
          Come gestire il pacing
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {estimate.pacing.pacing_advice.map((a, i) => (
            <div key={i} className="metric-card text-sm">
              <p className="font-medium capitalize">{a.label}</p>
              <p className="text-xs text-muted">
                km {a.from_km}–{a.to_km}
              </p>
              <p className="mt-2">
                {a.target_wkg != null ? `~${a.target_wkg} W/kg` : "—"}
                {a.avg_speed_kmh != null && (
                  <span className="text-secondary">
                    {" "}
                    (~{a.avg_speed_kmh} km/h)
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-secondary">
          Indicazione di lettura: nei primi km tieni il W/kg target del tratto
          «inizio»; sulle salite la velocità scende — è normale, stai spendendo
          al ritmo giusto e mantieni riserve per il finale.
        </p>
      </div>

      {/* e) Note metodologiche */}
      <p className="mt-5 flex flex-wrap items-center gap-1 text-xs italic text-muted">
        Stima basata sulla tua CP attuale ({Math.round(estimate.cp_w)} W
        <InfoTooltip term="cp_usato" />) e su un modello fisico per MTB
        (rolling resistance
        <InfoTooltip term="rolling_resistance" /> e aerodinamica). Peso{" "}
        {estimate.weight_kg} kg. Non include tratti tecnici estremi, soste extra
        o meteo. Aggiorna dopo ogni test FTP per una stima più precisa.
        {generatedAt &&
          ` · Stima del ${new Date(generatedAt).toLocaleDateString("it-IT")}`}
        {` · percorso ${COURSE_LABEL[terrain.course_character]}`}
      </p>
    </section>
  );
}

function ScenarioCard({
  label,
  subtitle,
  time,
  tooltip,
  highlight,
}: {
  label: string;
  subtitle: string;
  time: string;
  tooltip?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[11px] border border-border bg-surface-2 p-4 text-center ${
        highlight ? "border-amber" : ""
      }`}
    >
      <p className="flex items-center justify-center gap-1 text-sm font-medium">
        {label}
        {tooltip && <InfoTooltip term={tooltip} />}
      </p>
      <p className={`my-1 text-2xl font-semibold ${highlight ? "text-amber" : ""}`}>
        {time}
      </p>
      <p className="text-xs text-muted">{subtitle}</p>
    </div>
  );
}
