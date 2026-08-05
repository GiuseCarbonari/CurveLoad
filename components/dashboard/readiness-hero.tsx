import { CircleCheck, CircleAlert, CircleX } from "lucide-react";
import {
  computeReadinessScore,
  type ReadinessResult,
} from "@/lib/readiness";
import { cn } from "@/lib/utils";

/**
 * Apertura della pagina "oggi" (Passo 8, concept "Apertura del giorno" del
 * confronto direzioni): la readiness è la prima cosa che si vede, non una
 * card tra le altre. Sostituisce ReadinessRing — niente più anello/numero,
 * la frase-decisione è il titolo, il saluto è dentro il sottotitolo invece
 * che in un header separato sopra (vedi app/dashboard/page.tsx).
 */

const DECISION_ICON: Record<ReadinessResult["decision"], typeof CircleCheck> = {
  GO: CircleCheck,
  MODIFY: CircleAlert,
  SKIP: CircleX,
};

const DECISION_COLOR: Record<ReadinessResult["decision"], string> = {
  GO: "var(--ready-go)",
  MODIFY: "var(--ready-modify)",
  SKIP: "var(--ready-skip)",
};

const BADGE_BG: Record<ReadinessResult["decision"], string> = {
  GO: "bg-ready-go/[0.14]",
  MODIFY: "bg-ready-modify/[0.14]",
  SKIP: "bg-ready-skip/[0.14]",
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

/** Titolo hero: l'azione da fare oggi (prima l'ordine era leadText poi CTA,
 * qui invertito — il titolo apre con l'azione, il motivo segue sotto). */
const CTA: Record<ReadinessResult["decision"], string> = {
  GO: "Esegui la seduta prevista.",
  MODIFY: "Valuta di alleggerire la seduta.",
  SKIP: "Oggi è meglio fermarsi.",
};

const LEAD_TEXT: Record<ReadinessResult["decision"], string> = {
  GO: "Recupero buono e carico in equilibrio.",
  MODIFY: "Alcuni segnali suggeriscono cautela.",
  SKIP: "Il corpo ha bisogno di recupero.",
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

export function ReadinessHero({
  readiness,
  name,
  dateLabel,
}: {
  readiness: ReadinessResult;
  /** Nome dell'atleta, per il saluto integrato nel sottotitolo (prima era un header a parte). */
  name: string;
  /** Data di oggi già formattata (es. "Domenica 2 ago"), stessa fonte del vecchio header. */
  dateLabel: string;
}) {
  const DecisionIcon = DECISION_ICON[readiness.decision];
  const color = DECISION_COLOR[readiness.decision];
  const score = computeReadinessScore(readiness);

  const warningSignals = readiness.signals.filter(
    (s) => s.status === "amber" || s.status === "red"
  );
  const unavailableSignals = readiness.signals.filter(
    (s) => s.status === "unavailable"
  );
  const visibleSignals = [...warningSignals, ...unavailableSignals].slice(0, 5);
  const allGreen = visibleSignals.length === 0;

  return (
    <>
      {/* Fascia a piena larghezza: -mx-5 buca il px-5 di CurveLoadShell
          (vedi components/layout/curveload-shell.tsx) per sfumare da bordo
          a bordo, poi px-5 sul contenuto lo riallinea al resto della pagina.
          Il lavaggio di colore sfuma verso trasparente, non verso --bg-base:
          --bg-base è piatto, ma <body> ci disegna sopra anche --bg-glow (gli
          aloni ambientali della pagina, vedi globals.css) — sfumare verso un
          colore piatto lo copriva creando una cucitura visibile sopra e sotto
          la fascia invece di lasciarlo trasparire. */}
      <section
        id="tour-readiness"
        className="-mx-5 px-5 pb-6 pt-2"
        style={{
          background: `linear-gradient(165deg, color-mix(in srgb, ${color} 18%, transparent), transparent 65%)`,
        }}
      >
        <div className="flex items-start justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
            {dateLabel}
          </span>
          <a
            href="/settings/profile"
            className="text-[11px] text-faint transition-colors hover:text-secondary"
          >
            profilo ↗
          </a>
        </div>

        <div className="mt-5 flex items-start gap-3.5">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
              BADGE_BG[readiness.decision]
            )}
            style={{ animation: "fadeUp .5s ease .05s both" }}
            aria-label={`Readiness ${score} su 100, decisione ${readiness.decision}`}
          >
            <DecisionIcon className="h-7 w-7" style={{ color }} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h1
              className="text-balance font-serif text-[26px] font-medium leading-tight"
              style={{ color, animation: "fadeUp .55s ease .12s both" }}
            >
              {CTA[readiness.decision]}
            </h1>
            <p
              className="mt-1.5 text-[13.5px] leading-snug text-secondary"
              style={{ animation: "fadeUp .55s ease .2s both" }}
            >
              Ciao, {name} — {LEAD_TEXT[readiness.decision]}
            </p>
          </div>
        </div>
      </section>

      {/* Motivi: elenco segnali sempre visibile (non dietro un tap) + le
          miniature di tutti i segnali. Card neutra apposta: il colore della
          decisione lo porta già la fascia sopra, qui basta restare leggibili. */}
      <div
        className="rounded-metric border border-border px-5 py-4"
        style={{
          background: "var(--glass-bg)",
          borderColor: "var(--glass-border)",
          boxShadow: "var(--glass-shadow)",
          backdropFilter: "blur(20px) saturate(1.6)",
          WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        }}
      >
        {allGreen ? (
          <p className="text-[12.5px] text-ready-go">
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
                <span className="text-[12.5px] leading-snug text-secondary">
                  <span className="font-medium text-foreground">{SIGNAL_LABEL[s.name] ?? s.name}:</span>{" "}
                  {s.status === "unavailable"
                    ? (UNAVAILABLE_HINT[s.name] ?? s.detail)
                    : s.detail}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Marker precoce: non cambia la decisione di oggi, ma è la cosa che
            si vede prima che diventi un problema — va detta anche in un GO. */}
        {readiness.earlyWarning && (
          <p className="mt-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[12.5px] leading-snug text-secondary">
            <span className="font-medium text-foreground">Da tenere d&apos;occhio:</span>{" "}
            {readiness.earlyWarning}
          </p>
        )}

        <p className="mt-3 text-[11px] text-faint">
          Confidenza {readiness.confidence === "high" ? "alta" : readiness.confidence === "medium" ? "media" : "bassa"} — {CONFIDENCE_LABEL[readiness.confidence]}
        </p>

        {/* Solo quello che manca perché le soglie diventino tue: è azionabile
            e un giorno sparisce da solo. Le soglie già attive vivono nella
            card in impostazioni — qui sarebbero una riga che si legge una
            volta e poi si smette di vedere. */}
        {readiness.calibrationPending && readiness.calibrationPending.length > 0 && (
          <p className="mt-1 text-[11px] leading-relaxed text-faint">
            {readiness.calibrationPending.join(" ")}
          </p>
        )}

        {/* Griglia 2×3 (non una riga di 6: etichette come "Indice recupero"
            sfondavano il viewport sugli schermi stretti). */}
        <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 border-t border-border pt-3">
          {readiness.signals.map((s) => (
            <div key={s.name} className="flex flex-col items-center gap-1.5">
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
    </>
  );
}
