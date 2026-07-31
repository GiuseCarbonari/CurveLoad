import { CircleCheck, CircleAlert, CircleX } from "lucide-react";
import {
  computeReadinessScore,
  type ReadinessResult,
} from "@/lib/readiness";

const DECISION_ICON: Record<ReadinessResult["decision"], typeof CircleCheck> = {
  GO: CircleCheck,
  MODIFY: CircleAlert,
  SKIP: CircleX,
};

const RING: Record<ReadinessResult["decision"], { labelColor: string; glow: string }> = {
  GO: { labelColor: "var(--ready-go)", glow: "rgba(70,184,138,0.45)" },
  MODIFY: { labelColor: "var(--ready-modify)", glow: "rgba(224,168,62,0.45)" },
  SKIP: { labelColor: "var(--ready-skip)", glow: "rgba(217,102,91,0.45)" },
};

const TONE: Record<ReadinessResult["decision"], { border: string; bg: string; pillBg: string; pillBorder: string; pillText: string }> = {
  GO: {
    border: "border-ready-go-border",
    bg: "from-ready-go/[0.12] to-surface-2/60",
    pillBg: "bg-ready-go/[0.14]",
    pillBorder: "border-ready-go/40",
    pillText: "text-ready-go",
  },
  MODIFY: {
    border: "border-ready-modify-border",
    bg: "from-ready-modify/[0.12] to-surface-2/60",
    pillBg: "bg-ready-modify/[0.14]",
    pillBorder: "border-ready-modify/40",
    pillText: "text-ready-modify",
  },
  SKIP: {
    border: "border-ready-skip-border",
    bg: "from-ready-skip/[0.12] to-surface-2/60",
    pillBg: "bg-ready-skip/[0.14]",
    pillBorder: "border-ready-skip/40",
    pillText: "text-ready-skip",
  },
};

const SIGNAL_LABEL: Record<string, string> = {
  hrv: "HRV",
  rhr: "FC riposo",
  sleep: "Sonno",
  tsb: "Freschezza",
  acwr: "Carico",
  ri: "Indice recupero",
};

const STATUS_DOT: Record<string, string> = {
  green: "bg-ready-go",
  amber: "bg-ready-modify",
  red: "bg-ready-skip",
  unavailable: "bg-muted/40",
};

const CTA: Record<ReadinessResult["decision"], string> = {
  GO: "Esegui la seduta prevista.",
  MODIFY: "Valuta di alleggerire la seduta.",
  SKIP: "Oggi è meglio fermarsi.",
};

const CONFIDENCE_LABEL: Record<ReadinessResult["confidence"], string> = {
  high: "Dati completi",
  medium: "Alcuni dati mancano",
  low: "Pochi segnali",
};

/** Messaggio esplicativo per i segnali senza dato, mostrato al posto del solo pallino grigio. */
const UNAVAILABLE_HINT: Record<string, string> = {
  hrv: "nessun dato disponibile, collega un sensore o inseriscilo su Intervals.icu",
  rhr: "nessun dato disponibile, collega un sensore o inseriscilo su Intervals.icu",
  sleep: "nessun dato disponibile, collega un tracker del sonno o inseriscilo su Intervals.icu",
  ri: "non calcolabile: mancano HRV e/o FC riposo",
  tsb: "non disponibile, mancano i dati di carico (CTL/ATL) su Intervals.icu",
  acwr: "non disponibile, mancano i dati di carico (CTL/ATL) su Intervals.icu",
};

export function ReadinessRing({ readiness }: { readiness: ReadinessResult }) {
  const ring = RING[readiness.decision];
  const tone = TONE[readiness.decision];
  const score = computeReadinessScore(readiness);
  const DecisionIcon = DECISION_ICON[readiness.decision];

  const warningSignals = readiness.signals.filter(
    (s) => s.status === "amber" || s.status === "red"
  );
  const unavailableSignals = readiness.signals.filter(
    (s) => s.status === "unavailable"
  );
  const visibleSignals = [...warningSignals, ...unavailableSignals].slice(0, 5);
  const allGreen = visibleSignals.length === 0;
  const leadText =
    readiness.decision === "GO"
      ? "Recupero buono e carico in equilibrio."
      : readiness.decision === "MODIFY"
        ? "Alcuni segnali suggeriscono cautela."
        : "Il corpo ha bisogno di recupero.";

  return (
    <div
      id="tour-readiness"
      className={`relative overflow-hidden rounded-[24px] px-5 py-5 ${tone.border}`}
      style={{
        background: "var(--glass-bg)",
        border: "1px solid",
        borderColor: readiness.decision === "GO"
          ? "color-mix(in srgb, var(--ready-go) 30%, var(--glass-border))"
          : readiness.decision === "MODIFY"
          ? "color-mix(in srgb, var(--ready-modify) 30%, var(--glass-border))"
          : "color-mix(in srgb, var(--ready-skip) 30%, var(--glass-border))",
        boxShadow: `var(--glass-shadow), 0 0 32px -8px ${ring.glow}`,
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
      }}
    >
      {/* Header pill */}
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${tone.pillBg} ${tone.pillBorder} ${tone.pillText}`}
      >
        Readiness
      </span>

      {/* Body: ring + right column */}
      <div className="mt-4 flex items-center gap-5">
        {/* Decision icon */}
        <div
          className="relative flex h-[130px] w-[130px] shrink-0 items-center justify-center sm:h-[144px] sm:w-[144px]"
          aria-label={`Readiness ${score} su 100, decisione ${readiness.decision}`}
        >
          <DecisionIcon
            className="h-16 w-16 sm:h-[72px] sm:w-[72px]"
            style={{
              color: ring.labelColor,
              filter: `drop-shadow(0 0 14px ${ring.glow})`,
            }}
            strokeWidth={1.75}
          />
        </div>

        {/* Right: reason + signals */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* Lead sentence */}
          <p className="text-[13px] leading-snug text-secondary">
            {leadText}{" "}
            <span className="font-medium text-foreground">{CTA[readiness.decision]}</span>
          </p>

          {/* Signal pills */}
          {allGreen ? (
            <p className="text-[12px] text-ready-go">
              Tutti i segnali sono nella norma.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visibleSignals.map((s) => (
                <li key={s.name} className="flex items-start gap-2">
                  <span
                    className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[s.status] ?? "bg-muted"}`}
                    aria-hidden
                  />
                  <span className="text-[12px] leading-snug text-secondary">
                    <span className="font-medium text-foreground">{SIGNAL_LABEL[s.name] ?? s.name}:</span>{" "}
                    {s.status === "unavailable"
                      ? (UNAVAILABLE_HINT[s.name] ?? s.detail)
                      : s.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Confidence footer */}
          <p className="text-[11px] text-faint">
            Confidenza {readiness.confidence === "high" ? "alta" : readiness.confidence === "medium" ? "media" : "bassa"} — {CONFIDENCE_LABEL[readiness.confidence]}
          </p>
        </div>
      </div>

      {/* Signal bar: tutti i segnali in miniatura */}
      <div className="mt-4 flex gap-2 border-t border-border pt-3">
        {readiness.signals.map((s) => (
          <div key={s.name} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`h-1 w-full rounded-full ${STATUS_DOT[s.status] ?? "bg-muted/40"}`}
              style={{ opacity: s.status === "unavailable" ? 1 : 0.85 }}
            />
            <span className="text-[9px] uppercase tracking-[0.08em] text-faint">
              {SIGNAL_LABEL[s.name] ?? s.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
