"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Bottone «✍️ Scrivi la mia filosofia»: POST /api/profile/philosophy, poi
 * refresh (il testo salvato arriva dal Server Component). Stesso pattern di
 * components/profile/explain-profile-button.tsx.
 */
export function PhilosophyButton({
  enabled,
  hasPhilosophy,
  missingAnswers,
}: {
  enabled: boolean;
  hasPhilosophy: boolean;
  missingAnswers: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = hasPhilosophy
    ? "✍️ Riscrivi la filosofia"
    : "✍️ Scrivi la mia filosofia";

  if (!enabled) {
    return (
      <span
        title={
          missingAnswers
            ? "Rispondi prima alle domande in Impostazioni → La tua filosofia"
            : "Configura una API key Groq nelle impostazioni per attivare l'AI"
        }
      >
        <Button variant="outline" disabled>
          {label}
        </Button>
      </span>
    );
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/philosophy", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!response.ok || body?.success === false) {
        setError(body?.message ?? "Generazione della filosofia fallita");
        return;
      }
      router.refresh();
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => void handleClick()} disabled={loading}>
        {loading ? "Ci penso…" : label}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </>
  );
}
