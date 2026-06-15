"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Bottone di calibrazione firma di velocità (M7): POST /api/profile/calibrate,
 * poi refresh. La calibrazione analizza le ultime attività MTB lato server
 * (~30s). Etichetta variabile (Calibra / Migliora / Ricalibra) via `label`.
 */
export function CalibrateButton({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCalibrate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/calibrate", { method: "POST" });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(body?.message ?? "Calibrazione fallita");
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
      <Button variant={variant} onClick={() => void handleCalibrate()} disabled={loading}>
        {loading ? "Analizzo le tue attività MTB… (~30 secondi)" : label}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
