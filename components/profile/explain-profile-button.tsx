"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Bottone "💬 Spiega il mio profilo": POST /api/profile/explain, poi refresh
 * (il commento salvato arriva dal Server Component). Pattern di
 * components/profile/durability-button.tsx.
 *
 * `enabled` = chiave Groq disponibile (propria o fallback server — Passo 2
 * BYOK), calcolato nella pagina server: senza, bottone disabilitato col tooltip.
 */
export function ExplainProfileButton({
  enabled,
  hasComment,
}: {
  enabled: boolean;
  hasComment: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = hasComment ? "💬 Rigenera il commento" : "💬 Spiega il mio profilo";

  if (!enabled) {
    return (
      <span title="Configura una API key Groq nelle impostazioni per attivare il commento AI">
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
      const response = await fetch("/api/profile/explain", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!response.ok || body?.success === false) {
        setError(body?.message ?? "Generazione del commento fallita");
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
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" onClick={() => void handleClick()} disabled={loading}>
        {loading ? "Scrivo il commento…" : label}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
