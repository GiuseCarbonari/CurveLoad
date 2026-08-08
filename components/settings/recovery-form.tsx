"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  ChipMultiSelect,
  SelectField,
  YesNoField,
} from "@/components/onboarding/fields";
import type { RecoveryInputs } from "@/lib/recovery/baselines";

/**
 * "Come recuperi" — le quattro risposte che tarano il check di prontezza.
 *
 * Vive in impostazioni e non nell'onboarding di proposito: lo stress di vita
 * cambia, non è un dato una-tantum da raccogliere una volta e congelare.
 * Riusa i campi dell'onboarding (components/onboarding/fields.tsx): nessun
 * componente nuovo.
 *
 * Si chiede SOLO quello che Intervals non sa già. Le ore di sonno tipiche
 * erano qui e sono state tolte: quando le notti misurate ci sono vince la
 * mediana, e quando non ci sono il segnale sonno è "non disponibile" e nessuna
 * soglia viene applicata — la risposta non sarebbe mai servita a niente.
 */

const HRV_OPTIONS = [
  { value: "mattina", label: "Sì, ogni mattina" },
  { value: "saltuario", label: "Sì, saltuariamente" },
  { value: "no", label: "No" },
];

const STRESS_OPTIONS = [
  { value: "1", label: "1 - nessuno" },
  { value: "2", label: "2 - leggero" },
  { value: "3", label: "3 - presente" },
  { value: "4", label: "4 - alto" },
  { value: "5", label: "5 - molto alto" },
];

const OVERREACH_OPTIONS = [
  { value: "volume_troppo_in_fretta", label: "Alzo il volume troppo in fretta" },
  { value: "mai_salto_una_dura", label: "Non salto mai una seduta dura" },
  { value: "gara_in_allenamento", label: "Trasformo gli allenamenti in gare" },
  { value: "ignoro_i_segnali", label: "Ignoro i segnali di malessere" },
];

export function RecoveryForm({
  initial,
  applied,
}: {
  initial: RecoveryInputs;
  /** Soglie personali già attive: si leggono qui, non ogni giorno in dashboard. */
  applied: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<RecoveryInputs>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof RecoveryInputs>(
    key: K,
    value: RecoveryInputs[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/settings/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) {
      setError("Salvataggio fallito, riprova");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div>
      <p className="text-[13px] text-secondary">
        Servono a tarare il controllo di prontezza sui tuoi numeri invece che su
        medie generiche. Puoi lasciarli vuoti: senza risposte si usano le soglie
        standard. Sono dati sulla tua salute e restano nel tuo profilo, come il
        resto del dossier.
      </p>

      <div className="mt-4 space-y-4">
        <ChipMultiSelect
          label="Misuri la variabilità cardiaca (HRV)?"
          values={form.traccia_hrv ? [form.traccia_hrv] : []}
          options={HRV_OPTIONS}
          onToggle={(v) =>
            update("traccia_hrv", v as RecoveryInputs["traccia_hrv"])
          }
          single
          hint="Se rispondi No, l'HRV viene esclusa dal calcolo invece di usare misure vecchie."
        />

        <ChipMultiSelect
          label="Quanto stress hai adesso fuori dallo sport? (lavoro, famiglia, sonno interrotto)"
          values={form.stress_vita != null ? [String(form.stress_vita)] : []}
          options={STRESS_OPTIONS}
          onToggle={(v) =>
            update("stress_vita", Number(v) as RecoveryInputs["stress_vita"])
          }
          single
          hint="Lo stress fuori dallo sport consuma recupero quanto l'allenamento."
        />

        <YesNoField
          label="Hai infortuni che tendono a tornare?"
          value={form.infortuni_ricorrenti}
          onChange={(v) => update("infortuni_ricorrenti", v)}
        />

        <SelectField
          label="Quando esageri, come succede di solito?"
          value={form.stile_strafare ?? ""}
          onChange={(v) =>
            update(
              "stile_strafare",
              v === "" ? null : (v as RecoveryInputs["stile_strafare"])
            )
          }
          options={OVERREACH_OPTIONS}
          hint="Serve a dirti la cosa giusta nel momento giusto, con parole tue."
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Salvo…" : "Salva"}
        </Button>
        {saved && !error && (
          <span className="text-sm text-ready-go">
            Salvato ✓ — soglie ricalcolate
          </span>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-ready-skip">{error}</p>}

      {applied.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
            Soglie in uso adesso
          </div>
          <ul className="mt-2 space-y-1">
            {applied.map((nota) => (
              <li key={nota} className="text-[12.5px] leading-snug text-secondary">
                {nota}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-faint">
            Si aggiornano al prossimo &quot;Aggiorna dati&quot;.
          </p>
        </div>
      )}
    </div>
  );
}
