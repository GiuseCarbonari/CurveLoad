"use client";

import { COACHING_SCHOOLS } from "@/lib/coaching/schools";
import {
  ALLENAMENTI_OPTIONS,
  BLOCCHI_DURI_OPTIONS,
  DATI_SENSAZIONI_OPTIONS,
  GIORNI,
  INDOOR_OUTDOOR_OPTIONS,
  LIVELLO_OPTIONS,
  SESSO_OPTIONS,
  SPORT_OPTIONS,
  STILE_OPTIONS,
  STRUTTURA_OPTIONS,
  TONO_OPTIONS,
  type DossierForm,
  type FilosofiaForm,
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

/** Chip delle scuole: etichetta = solo il nome, senza il sottotitolo dopo "—". */
const SCUOLE_OPTIONS = COACHING_SCHOOLS.map((s) => ({
  value: s.id,
  label: s.nome.split("—")[0].trim(),
}));

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

/** true se il dossier dichiara Corsa (esclude Ciclismo: sono a scelta singola). */
function isCorsa(form: DossierForm): boolean {
  return form.sport_principali.includes("Corsa");
}

// --- Step 5: Chi sei ---------------------------------------------------------

export function StepChiSei({
  form,
  update,
}: {
  form: DossierForm;
  update: DossierUpdater;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ChipMultiSelect
        label="Che sport pratichi? *"
        values={form.sport_principali}
        options={SPORT_OPTIONS}
        single
        onToggle={(v) => update("sport_principali", [v])}
        hint="Determina che tipo di piano ti costruiamo"
      />
      <TextField
        label="Come ti chiami? *"
        value={form.nome}
        onChange={(v) => update("nome", v)}
        placeholder="Nome o nickname"
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Età"
          type="number"
          value={form.eta}
          onChange={(v) => update("eta", v)}
          placeholder="es. 34"
        />
        <SelectField
          label="Sesso"
          value={form.sesso}
          onChange={(v) => update("sesso", v)}
          options={SESSO_OPTIONS}
          hint="Opzionale"
        />
      </div>
      <SelectField
        label="Livello di esperienza *"
        value={form.livello_esperienza}
        onChange={(v) => update("livello_esperienza", v)}
        options={LIVELLO_OPTIONS}
      />
    </div>
  );
}

// --- Step 6: Obiettivi -------------------------------------------------------

export function StepObiettivi({
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
        label="Quali sono i tuoi obiettivi?"
        value={form.obiettivi}
        onChange={(v) => update("obiettivi", v)}
        placeholder="es. Arrivare in forma alla gara di settembre, migliorare la resistenza in salita, perdere qualche chilo mantenendo la potenza…"
        rows={3}
        hint="Opzionale — più sei specifico, più il piano sarà preciso"
      />

      <fieldset className="rounded-lg border border-border bg-surface-2 p-4">
        <legend className="px-1 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
          Gara target principale (opzionale)
        </legend>
        <div className="flex flex-col gap-4 pt-2">
          <TextField
            label="Nome gara"
            value={form.gara.nome}
            onChange={(v) => updateGara("nome", v)}
            placeholder="es. Granfondo delle Dolomiti"
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
    </div>
  );
}

// --- Step 7: La tua settimana ------------------------------------------------

export function StepSettimana({
  form,
  update,
}: {
  form: DossierForm;
  update: DossierUpdater;
}) {
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="Ore disponibili a settimana *"
        type="number"
        value={form.disponibilita_ore_sett}
        onChange={(v) => update("disponibilita_ore_sett", v)}
        placeholder="es. 8"
        hint="Indicative — il piano si adatta alla tua settimana reale"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Durata max seduta infrasettimanale (min)"
          type="number"
          value={form.durata_max_weekday_min}
          onChange={(v) => update("durata_max_weekday_min", v)}
          placeholder="es. 75"
          hint="Opzionale"
        />
        <TextField
          label="Durata max seduta weekend (min)"
          type="number"
          value={form.durata_max_weekend_min}
          onChange={(v) => update("durata_max_weekend_min", v)}
          placeholder="es. 180"
          hint="Opzionale"
        />
      </div>
      <ChipMultiSelect
        label="Giorni preferiti per allenarti"
        values={form.giorni_preferiti}
        options={GIORNI}
        onToggle={(v) => update("giorni_preferiti", toggle(form.giorni_preferiti, v))}
      />
      <ChipMultiSelect
        label="Giorni in cui non puoi allenarti"
        values={form.giorni_impossibili}
        options={GIORNI}
        onToggle={(v) => update("giorni_impossibili", toggle(form.giorni_impossibili, v))}
      />
      {/* Indoor/rulli hanno senso solo in bici: la corsa non ha uno "smart
          trainer" equivalente nel planner. */}
      {!isCorsa(form) && (
        <>
          <SelectField
            label="Preferisci indoor o outdoor?"
            value={form.indoor_outdoor}
            onChange={(v) => update("indoor_outdoor", v)}
            options={INDOOR_OUTDOOR_OPTIONS}
          />
          <YesNoField
            label="Rulli / smart trainer indoor?"
            value={form.ha_rulli}
            onChange={(v) => update("ha_rulli", v)}
          />
        </>
      )}
    </div>
  );
}

// --- Step 8: Salute e note ----------------------------------------------------

export function StepSalute({
  form,
  update,
}: {
  form: DossierForm;
  update: DossierUpdater;
}) {
  return (
    <div className="flex flex-col gap-4">
      <TextAreaField
        label="Infortuni attuali"
        value={form.infortuni_attuali}
        onChange={(v) => update("infortuni_attuali", v)}
        placeholder="es. Tendinite al ginocchio sinistro, in recupero da 3 settimane"
        hint="Opzionale"
        rows={2}
      />
      <TextAreaField
        label="Dolori o fastidi ricorrenti"
        value={form.dolore_attuale}
        onChange={(v) => update("dolore_attuale", v)}
        placeholder="es. Mal di schiena dopo uscite lunghe"
        hint="Opzionale"
        rows={2}
      />
      <TextAreaField
        label="Farmaci o integratori"
        value={form.farmaci_integratori}
        onChange={(v) => update("farmaci_integratori", v)}
        placeholder="es. Magnesio, vitamina D, ibuprofene al bisogno"
        hint="Opzionale — utile per contestualizzare alcune risposte fisiologiche"
        rows={2}
      />
      <TextAreaField
        label="Limiti o vincoli principali"
        value={form.limiti_principali}
        onChange={(v) => update("limiti_principali", v)}
        placeholder="es. Non posso allenarmi prima delle 7, ho un bambino piccolo"
        hint="Opzionale"
        rows={2}
      />
      <TextAreaField
        label="Note personali"
        value={form.note_personali}
        onChange={(v) => update("note_personali", v)}
        placeholder="Qualsiasi altra cosa vuoi che il coach sappia"
        hint="Opzionale"
        rows={2}
      />
    </div>
  );
}

// --- Step 9: La tua filosofia -----------------------------------------------

/**
 * Intervista sulla filosofia di coaching. Solo le domande che il dossier non
 * fa già altrove: gara, obiettivi, infortuni e ore disponibili stanno negli
 * step precedenti e non si ripetono.
 *
 * Le scuole scelte qui hanno l'ultima parola su `stile_allenamento` (vedi
 * formToPatch): la select sotto è il valore di partenza/fallback per chi non
 * ne sceglie nessuna.
 */
export function StepFilosofia({
  form,
  update,
}: {
  form: DossierForm;
  update: DossierUpdater;
}) {
  const f = form.filosofia;
  function set<K extends keyof FilosofiaForm>(key: K, value: FilosofiaForm[K]) {
    update("filosofia", { ...f, [key]: value });
  }
  // "Rulli / indoor" è un'opzione da bici: non ha senso proporla a un runner.
  const allenamentiOptions = isCorsa(form)
    ? ALLENAMENTI_OPTIONS.filter((o) => o.value !== "indoor")
    : ALLENAMENTI_OPTIONS;

  return (
    <div className="flex flex-col gap-4">
      <ChipMultiSelect
        label="Ci sono allenatori o scuole che ti convincono?"
        values={f.scuole}
        options={SCUOLE_OPTIONS}
        onToggle={(v) => set("scuole", toggle(f.scuole, v))}
        hint="Opzionale — se non ne conosci nessuna, lascia vuoto: le sceglie il coach dalle tue risposte qui sotto"
      />
      <TextAreaField
        label="Cosa ha funzionato e cosa è fallito, negli anni passati?"
        value={f.storia}
        onChange={(v) => set("storia", v)}
        placeholder="es. Con tre uscite a settimana costanti sono andato meglio che con sei sporadiche; ogni volta che ho alzato il volume di colpo mi sono infortunato"
        rows={3}
        hint="Opzionale"
      />
      <SelectField
        label="Come reagisci ai blocchi duri?"
        value={f.blocchi_duri}
        onChange={(v) => set("blocchi_duri", v)}
        options={BLOCCHI_DURI_OPTIONS}
      />
      <SelectField
        label="Struttura o flessibilità?"
        value={f.struttura}
        onChange={(v) => set("struttura", v)}
        options={STRUTTURA_OPTIONS}
      />
      <SelectField
        label="Ti fidi più dei dati o delle sensazioni?"
        value={f.dati_sensazioni}
        onChange={(v) => set("dati_sensazioni", v)}
        options={DATI_SENSAZIONI_OPTIONS}
      />
      <SelectField
        label="Come vuoi che il coach ti parli?"
        value={f.tono}
        onChange={(v) => set("tono", v)}
        options={TONO_OPTIONS}
      />
      <SelectField
        label="Stile di allenamento preferito"
        value={form.stile_allenamento}
        onChange={(v) => update("stile_allenamento", v)}
        options={STILE_OPTIONS}
        hint="Se scegli scuole qui sopra, sono loro a decidere lo stile: questa resta come riferimento senza scuole"
      />
      <ChipMultiSelect
        label="Cosa ti piace davvero fare?"
        values={f.piace}
        options={allenamentiOptions}
        onToggle={(v) => set("piace", toggle(f.piace, v))}
      />
      <ChipMultiSelect
        label="E cosa detesti?"
        values={f.detesta}
        options={allenamentiOptions}
        onToggle={(v) => set("detesta", toggle(f.detesta, v))}
        hint="Sapere cosa eviti conta quanto sapere cosa ti piace"
      />
    </div>
  );
}
