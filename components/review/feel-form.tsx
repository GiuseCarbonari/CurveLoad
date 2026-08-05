"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ChipMultiSelect, TextAreaField } from "@/components/onboarding/fields";
import type { FeelAnswers } from "@/lib/review/feel";

/**
 * Questionario "come ti sei sentito" — deterministico, non una chat (stessa
 * scelta dell'intervista sulla filosofia, StepFilosofia in
 * components/onboarding/dossier-fields.tsx). Riusa ChipMultiSelect in
 * modalità `single` per le scale 1-5: nessun componente nuovo.
 */

type Scale = 1 | 2 | 3 | 4 | 5;

const SCALE_VALUES: Scale[] = [1, 2, 3, 4, 5];

function scaleOptions(labels: [string, string, string, string, string]) {
  return SCALE_VALUES.map((v, i) => ({ value: String(v), label: `${v} - ${labels[i]}` }));
}

const ENERGIA_OPTIONS = scaleOptions(["molto bassa", "bassa", "media", "alta", "molto alta"]);
const SONNO_OPTIONS = scaleOptions(["molto scarso", "scarso", "così così", "buono", "ottimo"]);
const DOLORI_OPTIONS = scaleOptions(["nessuno", "leggeri", "presenti", "fastidiosi", "forti"]);
const STRESS_OPTIONS = scaleOptions(["nessuno", "leggero", "presente", "alto", "molto alto"]);
const MOTIVAZIONE_OPTIONS = scaleOptions(["molto bassa", "bassa", "media", "alta", "molto alta"]);

function ScaleField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: Scale;
  onChange: (v: Scale) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <ChipMultiSelect
      label={label}
      values={[String(value)]}
      options={options}
      onToggle={(v) => onChange(Number(v) as Scale)}
      single
    />
  );
}

export function FeelForm({
  weekLabel,
  prefill,
}: {
  weekLabel: string;
  /** Risposte già salvate (rigenerazione): precompila invece di ripartire da zero. */
  prefill?: FeelAnswers;
}) {
  const router = useRouter();
  const [energia, setEnergia] = useState<Scale>(prefill?.energia ?? 3);
  const [sonno, setSonno] = useState<Scale>(prefill?.sonno ?? 3);
  const [dolori, setDolori] = useState<Scale>(prefill?.dolori ?? 1);
  const [stress, setStress] = useState<Scale>(prefill?.stress ?? 3);
  const [motivazione, setMotivazione] = useState<Scale>(prefill?.motivazione ?? 3);
  const [seduteMigliori, setSeduteMigliori] = useState(prefill?.sedute_migliori ?? "");
  const [seductePeggiori, setSeductePeggiori] = useState(prefill?.sedute_peggiori ?? "");
  const [note, setNote] = useState(prefill?.note ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    const feel: FeelAnswers = {
      energia,
      sonno,
      dolori,
      stress,
      motivazione,
      sedute_migliori: seduteMigliori.trim() || null,
      sedute_peggiori: seductePeggiori.trim() || null,
      note: note.trim() || null,
    };
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(feel),
      });
      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!response.ok || body?.success === false) {
        setError(body?.message ?? "Generazione della review fallita");
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
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Come è andata la settimana {weekLabel}? Rispondi con calma: confrontiamo
        quello che senti con quello che dicono i dati.
      </p>
      <ScaleField label="Energia" value={energia} onChange={setEnergia} options={ENERGIA_OPTIONS} />
      <ScaleField label="Sonno" value={sonno} onChange={setSonno} options={SONNO_OPTIONS} />
      <ScaleField label="Dolori/fastidi" value={dolori} onChange={setDolori} options={DOLORI_OPTIONS} />
      <ScaleField label="Stress" value={stress} onChange={setStress} options={STRESS_OPTIONS} />
      <ScaleField
        label="Motivazione"
        value={motivazione}
        onChange={setMotivazione}
        options={MOTIVAZIONE_OPTIONS}
      />
      <TextAreaField
        label="Quale seduta è andata meglio?"
        value={seduteMigliori}
        onChange={setSeduteMigliori}
        placeholder="es. La lunga di domenica, mi sono sentito leggero fino alla fine"
        hint="Opzionale"
        rows={2}
      />
      <TextAreaField
        label="Quale seduta è andata peggio?"
        value={seductePeggiori}
        onChange={setSeductePeggiori}
        placeholder="es. Le ripetute di martedì, gambe pesanti da subito"
        hint="Opzionale"
        rows={2}
      />
      <TextAreaField
        label="Altro da segnalare?"
        value={note}
        onChange={setNote}
        hint="Opzionale"
        rows={2}
      />
      <div className="flex items-center gap-3">
        <Button onClick={() => void handleSubmit()} disabled={loading}>
          {loading ? "Sto leggendo la settimana…" : prefill ? "Rigenera la review" : "Chiudi la settimana"}
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}
