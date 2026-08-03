import { PhilosophyButton } from "./philosophy-button";
import { resolveSchools } from "@/lib/coaching/schools";

/**
 * Card «La tua filosofia» (Server Component, zero JS a parte il bottone).
 * Mostra la filosofia generata + le scuole scelte nell'intervista.
 *
 * Vive in /profile e non nell'onboarding di proposito: la filosofia si scrive
 * quando i dati ci sono. Al terzo minuto di onboarding il coach non ha ancora
 * niente da leggere e il paragrafo "chi sei come atleta" uscirebbe vuoto.
 */
export function PhilosophyCard({
  philosophy,
  philosophyAt,
  scuole,
  hasAnswers,
  aiEnabled,
}: {
  philosophy: string | null;
  philosophyAt: string | null;
  scuole: string[];
  hasAnswers: boolean;
  aiEnabled: boolean;
}) {
  const schools = resolveSchools(scuole);

  return (
    <div className="rounded-metric border border-border bg-surface px-5 py-5">
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted">
        La tua filosofia
      </span>

      {schools.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {schools.map((s) => (
            <span
              key={s.id}
              className="rounded-full border border-border px-2.5 py-0.5 text-[12px] text-secondary"
            >
              {s.nome.split("—")[0].trim()}
            </span>
          ))}
        </div>
      )}

      {philosophy ? (
        <div className="mt-3 flex flex-col gap-3">
          {philosophy.split(/\n\s*\n/).map((par, i) => (
            <p key={i} className="text-[14px] leading-relaxed text-secondary">
              {par.trim()}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          {hasAnswers
            ? "Le tue risposte ci sono. Scrivo il patto tra te e il tuo coach quando vuoi."
            : "Rispondi alle domande in Impostazioni → La tua filosofia e poi torna qui."}
        </p>
      )}

      <div className="mt-4 flex flex-col items-start gap-1.5">
        <PhilosophyButton
          enabled={aiEnabled && hasAnswers}
          hasPhilosophy={philosophy != null}
          missingAnswers={!hasAnswers}
        />
        {philosophyAt && (
          <span className="text-[11px] text-faint">
            Scritta il {new Date(philosophyAt).toLocaleDateString("it-IT")}
          </span>
        )}
      </div>
    </div>
  );
}
