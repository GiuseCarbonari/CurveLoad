"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Bottone "Genera settimana" (M6): POST /api/planner/generate, poi refresh dei
 * Server Component per mostrare il nuovo piano. La generazione è deterministica
 * lato server; qui si gestiscono solo stato di caricamento ed errori.
 */
export function GenerateWeekButton({ hasPlan }: { hasPlan: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/planner/generate", { method: "POST" });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(body?.message ?? "Generazione fallita");
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
      <Button onClick={() => void handleGenerate()} disabled={loading}>
        {loading ? "Genero la settimana…" : hasPlan ? "Rigenera settimana" : "Genera settimana"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
