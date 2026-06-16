import type { ReadinessResult } from "@/lib/readiness";

const RING: Record<
  ReadinessResult["decision"],
  { from: string; to: string; label: string; labelColor: string; glow: string }
> = {
  GO: {
    from: "#46b88a",
    to: "#7fc8c0",
    label: "Via libera",
    labelColor: "#7fe0b3",
    glow: "rgba(70,184,138,0.5)",
  },
  MODIFY: {
    from: "#e0a83e",
    to: "#f0c878",
    label: "Adatta la seduta",
    labelColor: "#f0c878",
    glow: "rgba(224,168,62,0.5)",
  },
  SKIP: {
    from: "#d9665b",
    to: "#ed8a82",
    label: "Riposo",
    labelColor: "#ed8a82",
    glow: "rgba(217,102,91,0.5)",
  },
};

const CARD_TONE: Record<ReadinessResult["decision"], { border: string; bg: string; pillBg: string; pillBorder: string; pillText: string }> = {
  GO: {
    border: "border-ready-go-border",
    bg: "from-ready-go/[0.16] to-[#0e121b]/50",
    pillBg: "bg-ready-go/[0.16]",
    pillBorder: "border-ready-go/40",
    pillText: "text-[#7fe0b3]",
  },
  MODIFY: {
    border: "border-ready-modify-border",
    bg: "from-ready-modify/[0.16] to-[#0e121b]/50",
    pillBg: "bg-ready-modify/[0.16]",
    pillBorder: "border-ready-modify/40",
    pillText: "text-[#f0c878]",
  },
  SKIP: {
    border: "border-ready-skip-border",
    bg: "from-ready-skip/[0.16] to-[#0e121b]/50",
    pillBg: "bg-ready-skip/[0.16]",
    pillBorder: "border-ready-skip/40",
    pillText: "text-[#ed8a82]",
  },
};

const CALL_TO_ACTION: Record<ReadinessResult["decision"], string> = {
  GO: "Esegui la seduta prevista.",
  MODIFY: "Valuta di alleggerire la seduta di oggi.",
  SKIP: "Oggi è meglio fermarsi.",
};

const FALLBACK_PHRASE: Record<ReadinessResult["decision"], string> = {
  GO: "Recupero buono e carico in equilibrio.",
  MODIFY: "Alcuni segnali suggeriscono cautela.",
  SKIP: "Il corpo ha bisogno di recupero.",
};

const CONFIDENCE_LABEL: Record<ReadinessResult["confidence"], string> = {
  high: "Confidenza alta — dati completi",
  medium: "Confidenza media — alcuni dati mancano",
  low: "Confidenza bassa — pochi segnali disponibili",
};

export function ReadinessRing({ readiness }: { readiness: ReadinessResult }) {
  const ring = RING[readiness.decision];
  const tone = CARD_TONE[readiness.decision];
  const criticalSignal = readiness.signals.find(
    (signal) => signal.status === "amber" || signal.status === "red"
  );
  const leadIn = criticalSignal?.detail ?? FALLBACK_PHRASE[readiness.decision];
  const gradientId = `readinessRing-${readiness.decision}`;

  return (
    <div
      className={`relative overflow-hidden rounded-[24px] border bg-gradient-to-br px-5 pb-6 pt-7 ${tone.border} ${tone.bg}`}
    >
      <span
        className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${tone.pillBg} ${tone.pillBorder} ${tone.pillText}`}
      >
        Readiness
      </span>

      <div className="mt-7 flex flex-col items-center">
        <div className="relative h-[170px] w-[170px] sm:h-[186px] sm:w-[186px]">
          <svg
            viewBox="0 0 200 200"
            className="h-full w-full"
            style={{ transform: "rotate(-90deg)" }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={ring.from} />
                <stop offset="100%" stopColor={ring.to} />
              </linearGradient>
            </defs>
            <circle
              cx="100"
              cy="100"
              r="84"
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="13"
            />
            <circle
              cx="100"
              cy="100"
              r="84"
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="13"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 9px ${ring.glow})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
            <span
              className="font-serif text-[22px] leading-tight"
              style={{ color: ring.labelColor }}
            >
              {ring.label}
            </span>
            <span className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted">
              {readiness.decision}
            </span>
          </div>
        </div>

        <p className="mt-4 max-w-[30ch] text-center text-sm leading-relaxed text-secondary">
          {leadIn} <span className="text-foreground">{CALL_TO_ACTION[readiness.decision]}</span>
        </p>
        <p className="mt-2 text-[11px] text-muted">{CONFIDENCE_LABEL[readiness.confidence]}</p>
      </div>
    </div>
  );
}
