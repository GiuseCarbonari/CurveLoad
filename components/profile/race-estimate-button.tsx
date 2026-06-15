"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Bottone "Aggiorna stima" (M race-estimate): POST /api/profile/race-estimate
 * e refresh dei Server Component. La stima si aggiorna comunque da sola dopo
 * una nuova analisi evento; questo bottone serve a forzarla (es. dopo un test
 * FTP che cambia la CP).
 */
export function RaceEstimateButton({ hasEstimate }: { hasEstimate: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEstimate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/race-estimate", {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        setError(body?.message ?? "Stima fallita");
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
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleEstimate()}
        disabled={loading}
      >
        {loading ? "Calcolo la stima…" : hasEstimate ? "Aggiorna stima" : "Stima tempi gara"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
