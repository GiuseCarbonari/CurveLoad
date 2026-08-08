"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Campo "API key Groq (opzionale, gratuita)" — Passo 2 (BYOK). Scrittura-only:
 * a riposo mostra solo "Configurata ✓ / Rimuovi", mai il valore (PIANO.md).
 * `hasKey` arriva dal Server Component (mai la chiave stessa, solo il booleano).
 */
export function GroqKeyForm({ hasKey }: { hasKey: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const apiKey = value.trim();
    if (!apiKey) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/settings/groq-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    }).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) {
      setError("Salvataggio fallito, riprova");
      return;
    }
    setValue("");
    router.refresh();
  }

  async function remove() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/settings/groq-key", { method: "DELETE" }).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) {
      setError("Rimozione fallita, riprova");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <p className="text-[13px] text-secondary">
        Usa la tua invece di quella condivisa — gratuita in 2 minuti su console.groq.com.
      </p>

      {hasKey ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm text-ready-go">Configurata ✓</span>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={saving}
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[12px] text-ready-skip transition-colors hover:bg-ready-skip/10 disabled:opacity-40"
          >
            {saving ? "Rimuovo…" : "Rimuovi"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="password"
            placeholder="gsk_..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-brand"
            aria-label="API key Groq"
          />
          <Button onClick={() => void save()} disabled={!value.trim() || saving}>
            {saving ? "Salvo…" : "Salva"}
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-ready-skip">{error}</p>}
    </div>
  );
}
