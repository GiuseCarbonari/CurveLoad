import Link from "next/link";

import type { Macrocycle, MacroPhase } from "@/lib/planner/macrocycle";
import type { Phase } from "@/lib/planner/phase-detector";

/**
 * Card «La stagione» — blocchi del macrociclo (Passo 8) + riga "sei dove
 * dovresti essere". Server Component: nessuno stato, nessuna chiamata AI.
 */

const PHASE_LABEL: Record<MacroPhase, string> = {
  base: "Base",
  build: "Build",
  peak: "Picco",
  taper: "Taper",
};

const MONTH_NAMES = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

/** Copiato da formatWeekRange (app/plan/page.tsx): niente util condivisa. */
function formatDate(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00`);
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}${year}`;
}

function daysToRaceLabel(days: number): string {
  if (days === 0) return "Oggi";
  if (days === 1) return "1 giorno alla gara";
  return `${days} giorni alla gara`;
}

export function SeasonCard({
  macro,
  raceName,
  detectedPhase,
  onTrack,
  alignmentReason,
}: {
  macro: Macrocycle;
  raceName: string | null;
  detectedPhase: Phase | null;
  onTrack: boolean | null;
  alignmentReason: string | null;
}): JSX.Element {
  if (macro.status === "no_race") {
    return (
      <div className="min-w-0 rounded-metric border border-border bg-surface px-4 py-3">
        <div className="mb-2 break-words text-[10px] uppercase tracking-[0.14em] text-accent2">
          La stagione
        </div>
        <p className="break-words text-[13px] text-secondary">
          Nessuna gara target: imposta data e nome della gara per vedere il
          calendario.
        </p>
        <Link
          href="/settings/profile"
          className="mt-2 inline-block break-words text-[12px] text-muted underline"
        >
          Vai alle impostazioni
        </Link>
      </div>
    );
  }

  if (macro.status === "race_past") {
    return (
      <div className="min-w-0 rounded-metric border border-border bg-surface px-4 py-3">
        <div className="mb-2 break-words text-[10px] uppercase tracking-[0.14em] text-accent2">
          La stagione
        </div>
        <p className="break-words text-[13px] text-secondary">
          La gara del {formatDate(macro.race_date as string)} è passata:
          aggiorna la data in Impostazioni → Profilo.
        </p>
        <Link
          href="/settings/profile"
          className="mt-2 inline-block break-words text-[12px] text-muted underline"
        >
          Vai alle impostazioni
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3 rounded-metric border border-border bg-surface px-4 py-3">
      <div>
        <div className="break-words text-[10px] uppercase tracking-[0.14em] text-accent2">
          La stagione
        </div>
        <p className="mt-1 break-words text-[13px] text-secondary">
          {raceName ?? "Gara target"} · {formatDate(macro.race_date as string)} ·{" "}
          {daysToRaceLabel(macro.days_to_race as number)}
        </p>
      </div>

      <ul className="space-y-2">
        {macro.blocks.map((block, i) => (
          <li key={block.phase} className="flex min-w-0 items-start gap-2">
            {i === 0 && (
              <span className="mt-0.5 shrink-0 rounded-full border border-brand/45 bg-brand-dim px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-brand-ink">
                Sei qui
              </span>
            )}
            <div className="min-w-0">
              <p className="break-words text-[13px] text-secondary">
                <span className="font-semibold text-foreground">
                  {PHASE_LABEL[block.phase]}
                </span>{" "}
                {formatDate(block.start)} → {formatDate(block.end)} · ≈
                {block.weeks} sett.
              </p>
              <p className="break-words text-[12px] text-muted">{block.focus}</p>
            </div>
          </li>
        ))}
      </ul>

      {detectedPhase != null && onTrack === true && (
        <p className="break-words text-[12px] text-muted">
          Il motore conferma: sei nella fase giusta.
        </p>
      )}
      {detectedPhase != null && onTrack === false && alignmentReason && (
        <p className="break-words text-[12px] text-muted">{alignmentReason}</p>
      )}
    </div>
  );
}
