"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Bottone "Aggiorna dati" (Milestone 2, punto 4d).
 *
 * Chiama POST /api/sync/intervals e poi fa il refresh dei Server Component
 * della pagina, che rileggono lo snapshot appena salvato dal DB. Il client
 * non riceve né maneggia dati Intervals: solo esito e orario.
 */
export function SyncButton({
  lastFetchedAt,
}: {
  lastFetchedAt: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stamp, setStamp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // L'orario si formatta solo sul client (useEffect) per evitare mismatch
  // di hydration tra fuso/locale del server e del browser.
  useEffect(() => {
    if (lastFetchedAt) {
      setStamp(
        new Date(lastFetchedAt).toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
  }, [lastFetchedAt]);

  async function handleSync() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/sync/intervals", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setError(body?.message ?? "Sincronizzazione fallita, riprova");
        // Token Intervals non più valido: è stato cancellato dal server,
        // il middleware porterà l'utente a /connect per ricollegarsi.
        if (response.status === 401 && body?.error === "intervals_unauthorized") {
          router.refresh();
        }
        return;
      }

      setStamp(
        new Date().toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      // Rilegge lo snapshot appena scritto nei Server Component.
      router.refresh();
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={() => void handleSync()} disabled={loading}>
        {loading ? "Sincronizzazione…" : "Aggiorna dati"}
      </Button>
      {stamp && !error && (
        <span className="text-xs text-muted">
          Aggiornato alle {stamp}
        </span>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
