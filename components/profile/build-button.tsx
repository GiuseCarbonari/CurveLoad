"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Bottone "Aggiorna profilo": chiama POST /api/profile/build e rilegge la
 * scheda dai Server Component. Stesso pattern del SyncButton della dashboard.
 */
export function BuildProfileButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuild() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/build", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        setError(body?.message ?? "Aggiornamento profilo fallito");
        if (response.status === 401 && body?.error === "intervals_unauthorized") {
          router.refresh(); // token cancellato: il middleware porta a /connect
        }
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
      <Button onClick={() => void handleBuild()} disabled={loading}>
        {loading ? "Costruzione…" : "Aggiorna profilo"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
