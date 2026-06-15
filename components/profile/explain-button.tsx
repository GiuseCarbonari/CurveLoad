"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Bottone "Spiega il mio profilo" nella sintesi atleta.
 *
 * - Senza API key (`configured` false): disabilitato, con tooltip che spiega
 *   come attivarlo. L'app resta perfettamente funzionante.
 * - Con key: al click genera il commento (3 paragrafi) e lo mostra sotto la
 *   card. Se un commento è già stato salvato, lo mostra subito con "rigenera".
 */
const NOT_CONFIGURED_HINT =
  "Configura una API key Anthropic in Impostazioni per attivare il commento AI";

export function ExplainButton({
  configured,
  initialComment,
  initialCommentAt,
}: {
  configured: boolean;
  initialComment: string | null;
  initialCommentAt: string | null;
}) {
  const [comment, setComment] = useState<string | null>(initialComment);
  const [commentAt, setCommentAt] = useState<string | null>(initialCommentAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/explain", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        configured?: boolean;
        comment?: string;
        generated_at?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        setError(body?.message ?? "Generazione del commento fallita");
        return;
      }
      if (body?.configured === false) {
        setError(NOT_CONFIGURED_HINT);
        return;
      }
      setComment(body?.comment ?? null);
      setCommentAt(body?.generated_at ?? null);
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-5">
      <div className="flex flex-wrap items-center gap-3">
        {comment ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleGenerate()}
            disabled={loading || !configured}
            title={configured ? undefined : NOT_CONFIGURED_HINT}
          >
            {loading ? "Rigenero…" : "Rigenera"}
          </Button>
        ) : (
          <Button
            onClick={() => void handleGenerate()}
            disabled={loading || !configured}
            title={configured ? undefined : NOT_CONFIGURED_HINT}
          >
            {loading ? "Genero il commento…" : "Spiega il mio profilo"}
          </Button>
        )}
        {!configured && !comment && (
          <span className="text-xs text-muted">
            {NOT_CONFIGURED_HINT}
          </span>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {comment && (
        <div className="mt-5 border-l-2 border-amber pl-4">
          <div className="space-y-2 text-sm leading-relaxed">
            {comment.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para.trim()}</p>
            ))}
          </div>
          <p className="mt-3 text-xs italic text-muted">
            Commento generato dall&apos;AI a partire dai tuoi dati — non
            sostituisce un preparatore
            {commentAt &&
              ` · ${new Date(commentAt).toLocaleDateString("it-IT")}`}
          </p>
        </div>
      )}
    </div>
  );
}
