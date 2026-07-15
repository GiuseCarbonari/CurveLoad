"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Bottone "Calcola durabilità": POST /api/profile/durability, poi refresh.
 * Copia il pattern di components/profile/calibrate-button.tsx.
 */
export function DurabilityButton({ label }: { label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/durability", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!response.ok || body?.success === false) {
        setError(body?.message ?? "Calcolo durabilità fallito");
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
      <Button onClick={() => void handleClick()} disabled={loading}>
        {loading ? "Analizzo le tue uscite lunghe… (~30 secondi)" : label}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
