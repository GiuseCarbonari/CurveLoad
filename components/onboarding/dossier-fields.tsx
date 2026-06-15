"use client";

import {
  GIORNI,
  INDOOR_OUTDOOR_OPTIONS,
  LIVELLO_OPTIONS,
  SESSO_OPTIONS,
  SPORT_OPTIONS,
  type DossierForm,
  type GaraTargetForm,
} from "@/lib/onboarding/dossier";

import {
  ChipMultiSelect,
  SelectField,
  TextAreaField,
  TextField,
  YesNoField,
} from "./fields";

/** Updater tipato di un singolo campo del form. */
export type DossierUpdater = <K extends keyof DossierForm>(
  key: K,
  value: DossierForm[K]
) => void;

/** Toggle di un valore in una lista (sport/giorni). */
function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

// --- Pagina A: anagrafica + sport --------------------------------------------

export function DossierPageA({
  form,
  update,
}: {
  form: DossierForm;
  update: DossierUpdater;
}) {
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="Nome *"
        value={form.nome}
        onChange={(v) => update("nome", v)}
        placeholder="Come ti chiami"
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Età"
          type="number"
          value={form.eta}
          onChange={(v) => update("eta", v)}
        />
        <SelectField
          label="Sesso"
          value={form.sesso}
          onChange={(v) => update("sesso", v)}
          options={SESSO_OPTIONS}
          hint="Opzionale, utile per alcune interpretazioni"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Altezza (cm)"
          type="number"
          value={form.altezza_cm}
          onChange={(v) => update("altezza_cm", v)}
        />
        <TextField
          label="Peso (kg)"
          type="number"
          value={form.peso_dichiarato_kg}
          onChange={(v) => update("peso_dichiarato_kg", v)}
        />
      </div>
      <ChipMultiSelect
        label="Sport principali"
        values={form.sport_principali}
        options={SPORT_OPTIONS.map((s) => ({ value: s, label: s }))}
        onToggle={(v) => update("sport_principali", toggle(form.sport_principali, v))}
      />
      <SelectField
        label="Livello di esperienza"
        value={form.livello_esperienza}
        onChange={(v) => update("livello_esperienza", v)}
        options={LIVELLO_OPTIONS}
      />
    </div>
  );
}

// --- Pagina B: obiettivi, gara, disponibilità --------------------------------

export function DossierPageB({
  form,
  update,
}: {
  form: DossierForm;
  update: DossierUpdater;
}) {
  function updateGara<K extends keyof GaraTargetForm>(
    key: K,
    value: GaraTargetForm[K]
  ) {
    update("gara", { ...form.gara, [key]: value });
  }

  return (
    <div className="flex flex-col gap-4">
      <TextAreaField
        label="Obiettivi"
        value={form.obiettivi}
        onChange={(v) => update("obiettivi", v)}
        placeholder="Cosa vuoi ottenere? (es. arrivare in forma alla gara, migliorare in salita…)"
      />

      <fieldset className="rounded-[11px] border border-border bg-surface-2 p-4">
        <legend className="px-1 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
          Gara target principale
        </legend>
        <div className="flex flex-col gap-4">
          <TextField
            label="Nome gara"
            value={form.gara.nome}
            onChange={(v) => updateGara("nome", v)}
            placeholder="es. Esatrail Super Hero"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField
              label="Data"
              type="date"
              value={form.gara.data}
              onChange={(v) => updateGara("data", v)}
            />
            <TextField
              label="Distanza (km)"
              type="number"
              value={form.gara.distanza_km}
              onChange={(v) => updateGara("distanza_km", v)}
            />
            <TextField
              label="Dislivello (m)"
              type="number"
              value={form.gara.dislivello_m}
              onChange={(v) => updateGara("dislivello_m", v)}
            />
          </div>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField
          label="Ore disponibili a settimana"
          type="number"
          value={form.disponibilita_ore_sett}
          onChange={(v) => update("disponibilita_ore_sett", v)}
        />
        <TextField
          label="Durata max seduta infrasettimanale (min)"
          type="number"
          value={form.durata_max_weekday_min}
          onChange={(v) => update("durata_max_weekday_min", v)}
        />
        <TextField
          label="Durata max seduta weekend (min)"
          type="number"
          value={form.durata_max_weekend_min}
          onChange={(v) => update("durata_max_weekend_min", v)}
        />
      </div>

      <ChipMultiSelect
        label="Giorni preferiti per allenarsi"
        values={form.giorni_preferiti}
        options={GIORNI}
        onToggle={(v) => update("giorni_preferiti", toggle(form.giorni_preferiti, v))}
      />
      <ChipMultiSelect
        label="Giorni impossibili"
        values={form.giorni_impossibili}
        options={GIORNI}
        onToggle={(v) =>
          update("giorni_impossibili", toggle(form.giorni_impossibili, v))
        }
      />
    </div>
  );
}

// --- Attrezzatura, limiti, note ----------------------------------------------

export function DossierEquipment({
  form,
  update,
}: {
  form: DossierForm;
  update: DossierUpdater;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <YesNoField
          label="Hai i rulli indoor?"
          value={form.ha_rulli}
          onChange={(v) => update("ha_rulli", v)}
        />
        <YesNoField
          label="Misuratore di potenza?"
          value={form.ha_misuratore_potenza}
          onChange={(v) => update("ha_misuratore_potenza", v)}
        />
        <YesNoField
          label="Fascia cardio?"
          value={form.ha_fascia_cardio}
          onChange={(v) => update("ha_fascia_cardio", v)}
        />
        <YesNoField
          label="Smartwatch?"
          value={form.ha_smartwatch}
          onChange={(v) => update("ha_smartwatch", v)}
        />
      </div>
      <SelectField
        label="Indoor o outdoor?"
        value={form.indoor_outdoor}
        onChange={(v) => update("indoor_outdoor", v)}
        options={INDOOR_OUTDOOR_OPTIONS}
      />
      <TextAreaField
        label="Infortuni attuali"
        value={form.infortuni_attuali}
        onChange={(v) => update("infortuni_attuali", v)}
        hint="Opzionale"
        rows={2}
      />
      <TextAreaField
        label="Dolore attuale"
        value={form.dolore_attuale}
        onChange={(v) => update("dolore_attuale", v)}
        hint="Opzionale"
        rows={2}
      />
      <TextAreaField
        label="Preferenze di allenamento"
        value={form.preferenze_allenamento}
        onChange={(v) => update("preferenze_allenamento", v)}
        hint="Opzionale"
        rows={2}
      />
      <TextAreaField
        label="Limiti principali"
        value={form.limiti_principali}
        onChange={(v) => update("limiti_principali", v)}
        hint="Opzionale"
        rows={2}
      />
      <TextAreaField
        label="Note personali"
        value={form.note_personali}
        onChange={(v) => update("note_personali", v)}
        hint="Opzionale"
        rows={2}
      />
    </div>
  );
}
