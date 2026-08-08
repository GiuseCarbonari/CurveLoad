"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SelectField, TextAreaField, TextField } from "@/components/onboarding/fields";
import { formatRaceTime } from "@/lib/profile/race-time";

/**
 * "Le tue gare" — risultati passati (corsa), input per la previsione Riegel.
 *
 * Tabella separata da gare_target (quella tiene solo obiettivi futuri, letti
 * dal macrociclo). Qui vive solo la corsa: la formula di Riegel e il motore
 * CS/D' condividono lo stesso dominio (corsa), niente equivalente per la
 * bici in questo giro.
 */

export interface RaceResultItem {
  id: string;
  nome: string | null;
  data: string;
  distanza_km: number;
  tempo_finale_s: number;
  livello_preparazione: string | null;
}

const LIVELLO_OPTIONS = [
  { value: "ben_allenato", label: "Ben allenato" },
  { value: "nella_media", label: "Nella media" },
  { value: "sottopreparato", label: "Sottopreparato" },
];

const LIVELLO_LABEL: Record<string, string> = {
  ben_allenato: "Ben allenato",
  nella_media: "Nella media",
  sottopreparato: "Sottopreparato",
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${d.toLocaleString("it-IT", { month: "short" })} ${d.getFullYear()}`;
}

const EMPTY_FORM = {
  nome: "",
  data: "",
  distanza_km: "",
  tempo_finale: "",
  livello_preparazione: "",
  note: "",
  stima_orologio: "",
};

export function RaceResultsForm({ items }: { items: RaceResultItem[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(items.length === 0);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    setError(null);
    const res = await fetch(`/api/settings/race-results?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => null);
    setDeleting(null);
    if (!res || !res.ok) {
      setError("Cancellazione fallita, riprova");
      return;
    }
    router.refresh();
  }

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/settings/race-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.nome,
        data: form.data,
        distanza_km: form.distanza_km === "" ? null : Number(form.distanza_km),
        tempo_finale: form.tempo_finale,
        livello_preparazione: form.livello_preparazione || null,
        note: form.note,
        stima_orologio: form.stima_orologio,
      }),
    }).catch(() => null);
    setSaving(false);

    if (!res || !res.ok) {
      const body = await res?.json().catch(() => null);
      setError(
        body?.error === "duplicate"
          ? "Hai già registrato una gara su questa distanza in questa data."
          : body?.error?.startsWith("invalid_")
            ? "Controlla i campi: data, distanza e tempo devono essere validi (tempo come mm:ss o h:mm:ss)."
            : "Salvataggio fallito, riprova."
      );
      return;
    }

    setForm(EMPTY_FORM);
    router.refresh();
  }

  return (
    <div>
      <p className="text-[13px] text-secondary">
        Risultati di gare già corse. Servono per la previsione Riegel — con
        due o più gare su distanze diverse, il coach può stimare il tuo
        esponente personale invece di quello medio.
      </p>

      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-faint">
          Nessuna gara registrata. Con una sola hai già una previsione
          standard; con due sblocchi la versione personale.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.1em] text-faint">
                  {formatDate(item.data)} · {item.distanza_km} km
                  {item.livello_preparazione &&
                    ` · ${LIVELLO_LABEL[item.livello_preparazione] ?? item.livello_preparazione}`}
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-secondary">
                  {item.nome ?? "Gara senza nome"} — {formatRaceTime(item.tempo_finale_s)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(item.id)}
                disabled={deleting === item.id}
                aria-label={`Elimina la gara del ${formatDate(item.data)}`}
                className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[13px] leading-none text-faint transition-colors hover:border-ready-skip/40 hover:text-ready-skip disabled:opacity-40"
              >
                {deleting === item.id ? "…" : "×"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-full border border-border px-3 py-1.5 text-[13px] text-secondary transition-colors hover:bg-surface-2"
        >
          + Aggiungi una gara
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <TextField
            label="Nome gara"
            value={form.nome}
            onChange={(v) => update("nome", v)}
            placeholder="es. Mezza di Terni"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TextField
              label="Data"
              type="date"
              value={form.data}
              onChange={(v) => update("data", v)}
            />
            <TextField
              label="Distanza (km)"
              type="number"
              value={form.distanza_km}
              onChange={(v) => update("distanza_km", v)}
              placeholder="es. 21.0975"
            />
            <TextField
              label="Tempo finale"
              value={form.tempo_finale}
              onChange={(v) => update("tempo_finale", v)}
              placeholder="h:mm:ss o mm:ss"
            />
          </div>
          <SelectField
            label="Quanto ti sentivi allenato/pacato"
            value={form.livello_preparazione}
            onChange={(v) => update("livello_preparazione", v)}
            options={LIVELLO_OPTIONS}
            hint="Non entra nel calcolo — dice solo quanto fidarsi del risultato come base"
          />
          <TextField
            label="Cosa prevedeva il tuo orologio per questa gara (facoltativo)"
            value={form.stima_orologio}
            onChange={(v) => update("stima_orologio", v)}
            placeholder="h:mm:ss o mm:ss — dato non verificato, solo per confronto"
          />
          <TextAreaField
            label="Note su condizioni particolari (facoltativo)"
            value={form.note}
            onChange={(v) => update("note", v)}
            placeholder="es. caldo, tanto dislivello, infortunio in corsa…"
            rows={2}
          />

          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={
                saving || form.data === "" || form.distanza_km === "" || form.tempo_finale === ""
              }
              className="rounded-full border border-amber bg-amber px-4 py-1.5 text-[13px] text-amber-on transition-colors disabled:opacity-40"
            >
              {saving ? "Salvo…" : "Salva gara"}
            </button>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[13px] text-faint hover:text-secondary"
              >
                Annulla
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-ready-skip">{error}</p>}
    </div>
  );
}
