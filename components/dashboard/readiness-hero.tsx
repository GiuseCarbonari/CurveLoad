import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { ReadinessResult, ReadinessSignal } from "@/lib/readiness";
import { cn } from "@/lib/utils";

const STYLES: Record<
  ReadinessResult["decision"],
  { text: string; border: string; bar: string }
> = {
  GO: {
    text: "text-ready-go",
    border: "border-ready-go-border",
    bar: "border-l-ready-go",
  },
  MODIFY: {
    text: "text-ready-modify",
    border: "border-ready-modify-border",
    bar: "border-l-ready-modify",
  },
  SKIP: {
    text: "text-ready-skip",
    border: "border-ready-skip-border",
    bar: "border-l-ready-skip",
  },
};

const COPY: Record<
  ReadinessResult["decision"],
  { title: string; fallback: string; action: string }
> = {
  GO: {
    title: "Sei pronto per la seduta prevista.",
    fallback: "Nessun segnale critico rilevato nei dati di oggi.",
    action: "Apri il piano di oggi",
  },
  MODIFY: {
    title: "Oggi conviene adattare il carico.",
    fallback: "Almeno un segnale suggerisce una seduta più controllata.",
    action: "Controlla il piano adattato",
  },
  SKIP: {
    title: "Oggi il recupero viene prima.",
    fallback: "I segnali disponibili indicano di evitare la seduta prevista.",
    action: "Controlla il piano di recupero",
  },
};

const CONFIDENCE_LABELS: Record<ReadinessResult["confidence"], string> = {
  high: "alta",
  medium: "media",
  low: "bassa",
};

function SignalList({ signals }: { signals: ReadinessSignal[] }) {
  return (
    <ul className="space-y-2 text-sm leading-relaxed text-secondary">
      {signals.map((signal) => (
        <li key={signal.name} className="flex gap-2.5">
          <span
            className={cn(
              "mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full",
              signal.status === "red"
                ? "bg-ready-skip"
                : "bg-ready-modify"
            )}
            aria-hidden
          />
          <span>{signal.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export function ReadinessHero({
  readiness,
}: {
  readiness: ReadinessResult;
}) {
  const styles = STYLES[readiness.decision];
  const copy = COPY[readiness.decision];
  const signals = readiness.signals.filter(
    (signal) => signal.status === "amber" || signal.status === "red"
  );
  const visibleSignals = signals.slice(0, 3);
  const hiddenSignals = signals.slice(3);

  return (
    <section
      className={cn(
        "rounded-2xl border border-l-[3px] bg-surface px-5 py-6 sm:px-7 sm:py-7",
        styles.border,
        styles.bar
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          Readiness di oggi
        </p>
        <p className="text-xs text-muted">
          Confidenza {CONFIDENCE_LABELS[readiness.confidence]}
        </p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(170px,0.7fr)_minmax(0,1.3fr)] md:items-start md:gap-10">
        <div>
          <p
            className={cn(
              "text-[46px] font-semibold leading-none tracking-[-0.045em] sm:text-[56px]",
              styles.text
            )}
          >
            {readiness.decision}
          </p>
        </div>

        <div className="max-w-xl">
          <h2 className="text-xl font-medium leading-snug tracking-[-0.02em] text-foreground sm:text-[22px]">
            {copy.title}
          </h2>

          <div className="mt-3">
            {visibleSignals.length > 0 ? (
              <SignalList signals={visibleSignals} />
            ) : (
              <p className="text-sm leading-relaxed text-secondary">
                {copy.fallback}
              </p>
            )}
          </div>

          {hiddenSignals.length > 0 && (
            <details className="group mt-3 text-sm">
              <summary className="min-h-10 cursor-pointer list-none py-2 text-muted transition-colors hover:text-foreground">
                <span className="group-open:hidden">
                  Mostra altri {hiddenSignals.length} segnali
                </span>
                <span className="hidden group-open:inline">Nascondi dettagli</span>
              </summary>
              <SignalList signals={hiddenSignals} />
            </details>
          )}

          <Button asChild variant="outline" className="mt-5 w-full sm:w-auto">
            <Link href="/plan">{copy.action}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
