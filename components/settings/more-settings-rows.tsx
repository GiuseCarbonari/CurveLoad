"use client";

import { useState } from "react";
import { BookOpen, KeyRound, Moon, Sparkles, Trophy } from "lucide-react";

import { AccordionRow } from "./accordion-row";
import { CoachMemoryList, type CoachMemoryItem } from "./coach-memory-list";
import { GroqKeyForm } from "./groq-key-form";
import { RaceResultsForm, type RaceResultItem } from "./race-results-form";
import { RecoveryForm } from "./recovery-form";
import { PhilosophyButton } from "@/components/profile/philosophy-button";
import type { RecoveryInputs } from "@/lib/recovery/baselines";

type RowKey = "recupero" | "gare" | "memoria" | "filosofia_ai" | "groq_key";

/**
 * Le voci "esterne" al dossier (recupero, gare, taccuino, testo del coach,
 * chiave Groq) come righe della STESSA lista ad accordion, non più card di
 * vetro separate una sotto l'altra — su richiesta di Giuseppe dopo aver
 * visto la pagina crescere con ogni rifinitura.
 */
export function MoreSettingsRows({
  recoveryInitial,
  recoveryApplied,
  isRunner,
  raceResults,
  memories,
  aiEnabled,
  hasPhilosophy,
  missingPhilosophyAnswers,
  hasGroqKey,
}: {
  recoveryInitial: RecoveryInputs;
  recoveryApplied: string[];
  isRunner: boolean;
  raceResults: RaceResultItem[];
  memories: CoachMemoryItem[];
  aiEnabled: boolean;
  hasPhilosophy: boolean;
  missingPhilosophyAnswers: boolean;
  hasGroqKey: boolean;
}) {
  const [expanded, setExpanded] = useState<RowKey | null>(null);

  function toggle(key: RowKey) {
    setExpanded((cur) => (cur === key ? null : key));
  }

  return (
    <>
      <AccordionRow
        icon={Moon}
        label="Come recuperi"
        isExpanded={expanded === "recupero"}
        onToggle={() => toggle("recupero")}
      >
        <RecoveryForm initial={recoveryInitial} applied={recoveryApplied} />
      </AccordionRow>

      {isRunner && (
        <AccordionRow
          icon={Trophy}
          label="Le tue gare"
          isExpanded={expanded === "gare"}
          onToggle={() => toggle("gare")}
        >
          <RaceResultsForm items={raceResults} />
        </AccordionRow>
      )}

      <AccordionRow
        icon={BookOpen}
        label="Gli appunti del coach"
        isExpanded={expanded === "memoria"}
        onToggle={() => toggle("memoria")}
      >
        <CoachMemoryList items={memories} />
      </AccordionRow>

      <AccordionRow
        icon={Sparkles}
        label="Il testo del coach"
        isExpanded={expanded === "filosofia_ai"}
        onToggle={() => toggle("filosofia_ai")}
      >
        <p className="text-[13px] text-secondary">
          È stato scritto una volta sui dati di allora e non si aggiorna da
          solo. Se hai cambiato le risposte nella tua filosofia — o se
          racconta cose che non valgono più — riscrivilo.
        </p>
        <div className="mt-3">
          <PhilosophyButton
            enabled={aiEnabled && !missingPhilosophyAnswers}
            hasPhilosophy={hasPhilosophy}
            missingAnswers={missingPhilosophyAnswers}
          />
        </div>
      </AccordionRow>

      <AccordionRow
        icon={KeyRound}
        label="API key Groq (opzionale, gratuita)"
        isExpanded={expanded === "groq_key"}
        onToggle={() => toggle("groq_key")}
      >
        <GroqKeyForm hasKey={hasGroqKey} />
      </AccordionRow>
    </>
  );
}
