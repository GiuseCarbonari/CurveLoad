"use client";

import { useState } from "react";

import {
  DossierEquipment,
  DossierPageA,
  DossierPageB,
  type DossierUpdater,
} from "@/components/onboarding/dossier-fields";
import { Button } from "@/components/ui/button";
import { formToPatch, type DossierForm } from "@/lib/onboarding/dossier";

/**
 * Form completo del dossier per /settings/profile: stessi campi dell'onboarding
 * (riusa DossierPageA/B + Equipment), ma in un'unica pagina pre-compilata,
 * modificabile in qualsiasi momento. Salva senza toccare lo stato onboarding.
 */
export function SettingsDossierForm({ initialForm }: { initialForm: DossierForm }) {
  const [form, setForm] = useState<DossierForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update: DossierUpdater = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/onboarding/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: formToPatch(form) }),
    }).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) {
      setError("Salvataggio fallito, riprova");
      return;
    }
    setSaved(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Modifica profilo
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Aggiorna il tuo dossier in qualsiasi momento.
        </p>
      </div>

      <section className="panel flex flex-col gap-4">
        <h2 className="panel-title">Anagrafica e sport</h2>
        <DossierPageA form={form} update={update} />
      </section>

      <section className="panel flex flex-col gap-4">
        <h2 className="panel-title">Obiettivi e disponibilità</h2>
        <DossierPageB form={form} update={update} />
      </section>

      <section className="panel flex flex-col gap-4">
        <h2 className="panel-title">Attrezzatura e limiti</h2>
        <DossierEquipment form={form} update={update} />
      </section>

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border bg-base/95 py-4">
        {saved && <span className="text-sm text-ready-go">Salvato ✓</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
        <Button
          onClick={() => void handleSave()}
          disabled={saving || form.nome.trim() === ""}
        >
          {saving ? "Salvo…" : "Salva modifiche"}
        </Button>
      </div>
    </div>
  );
}
