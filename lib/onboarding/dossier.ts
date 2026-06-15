/**
 * Dossier atleta (PRD §12.2) — tipi, costanti e mappatura form ⇄ DB.
 *
 * Modulo puro (no React): usato sia dal wizard di /onboarding sia dal form di
 * /settings/profile, così le due UI restano allineate sugli stessi campi e
 * sulla stessa serializzazione verso athlete_profiles.
 */

/** Gara target principale, salvata in athlete_profiles.gare_target (JSONB). */
export interface GaraTarget {
  nome: string;
  data: string; // YYYY-MM-DD
  distanza_km: number | null;
  dislivello_m: number | null;
}

/**
 * Stato del form: tutti i campi sono stringhe (input controllati) tranne le
 * liste e le tristate sì/no. La conversione ai tipi DB avviene in formToPatch.
 */
export interface DossierForm {
  // Pagina A
  nome: string;
  eta: string;
  sesso: string; // "" | "M" | "F" | "other"
  altezza_cm: string;
  peso_dichiarato_kg: string;
  sport_principali: string[];
  livello_esperienza: string; // "" | "beginner" | "intermediate" | "advanced"
  // Pagina B
  obiettivi: string;
  gara: GaraTargetForm;
  disponibilita_ore_sett: string;
  giorni_preferiti: string[];
  giorni_impossibili: string[];
  durata_max_weekday_min: string;
  durata_max_weekend_min: string;
  // Attrezzatura e contesto
  indoor_outdoor: string; // "" | "indoor" | "outdoor" | "both"
  ha_rulli: boolean | null;
  ha_misuratore_potenza: boolean | null;
  ha_fascia_cardio: boolean | null;
  ha_smartwatch: boolean | null;
  // Limiti, infortuni, note
  infortuni_attuali: string;
  dolore_attuale: string;
  preferenze_allenamento: string;
  limiti_principali: string;
  note_personali: string;
}

/** Versione "stringhe" della gara target, per gli input controllati. */
export interface GaraTargetForm {
  nome: string;
  data: string;
  distanza_km: string;
  dislivello_m: string;
}

// --- Opzioni di scelta -------------------------------------------------------

export const SPORT_OPTIONS = [
  "Ciclismo strada",
  "MTB / gravel",
  "Corsa",
  "Trail running",
  "Triathlon",
  "Nuoto",
] as const;

export const LIVELLO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzato" },
];

export const SESSO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "M", label: "Uomo" },
  { value: "F", label: "Donna" },
  { value: "other", label: "Altro / preferisco non dirlo" },
];

export const INDOOR_OUTDOOR_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "outdoor", label: "Soprattutto outdoor" },
  { value: "indoor", label: "Soprattutto indoor" },
  { value: "both", label: "Entrambi" },
];

/** Giorni della settimana (chiave stabile + etichetta). */
export const GIORNI: Array<{ value: string; label: string }> = [
  { value: "mon", label: "Lun" },
  { value: "tue", label: "Mar" },
  { value: "wed", label: "Mer" },
  { value: "thu", label: "Gio" },
  { value: "fri", label: "Ven" },
  { value: "sat", label: "Sab" },
  { value: "sun", label: "Dom" },
];

// --- Step del wizard ---------------------------------------------------------

/** Step coperti dal wizard (1-2 fatti prima: account + Intervals). */
export const FIRST_STEP = 3;
export const LAST_STEP = 7;

export const STEP_LABELS: Record<number, string> = {
  3: "Consenso privacy",
  4: "Come funziona",
  5: "Dossier atleta",
  6: "Attrezzatura e limiti",
  7: "Prima analisi",
};

// --- Mappatura DB ⇄ form -----------------------------------------------------

/** Colonne di athlete_profiles scrivibili dal dossier (whitelist per la API). */
export const DOSSIER_COLUMNS = [
  "nome",
  "eta",
  "sesso",
  "altezza_cm",
  "peso_dichiarato_kg",
  "sport_principali",
  "livello_esperienza",
  "obiettivi",
  "gare_target",
  "data_obiettivo",
  "disponibilita_ore_sett",
  "giorni_preferiti",
  "giorni_impossibili",
  "durata_max_weekday_min",
  "durata_max_weekend_min",
  "indoor_outdoor",
  "ha_rulli",
  "ha_misuratore_potenza",
  "ha_fascia_cardio",
  "ha_smartwatch",
  "infortuni_attuali",
  "dolore_attuale",
  "preferenze_allenamento",
  "limiti_principali",
  "note_personali",
] as const;

export type DossierColumn = (typeof DOSSIER_COLUMNS)[number];

/** Riga DB (sottoinsieme dossier), come letta da Supabase. */
export type DossierRow = Partial<Record<DossierColumn, unknown>>;

const EMPTY_GARA: GaraTargetForm = {
  nome: "",
  data: "",
  distanza_km: "",
  dislivello_m: "",
};

export function emptyDossierForm(): DossierForm {
  return {
    nome: "",
    eta: "",
    sesso: "",
    altezza_cm: "",
    peso_dichiarato_kg: "",
    sport_principali: [],
    livello_esperienza: "",
    obiettivi: "",
    gara: { ...EMPTY_GARA },
    disponibilita_ore_sett: "",
    giorni_preferiti: [],
    giorni_impossibili: [],
    durata_max_weekday_min: "",
    durata_max_weekend_min: "",
    indoor_outdoor: "",
    ha_rulli: null,
    ha_misuratore_potenza: null,
    ha_fascia_cardio: null,
    ha_smartwatch: null,
    infortuni_attuali: "",
    dolore_attuale: "",
    preferenze_allenamento: "",
    limiti_principali: "",
    note_personali: "",
  };
}

/** Coercizioni di lettura: valore DB → stringa/array/boolean per il form. */
function str(v: unknown): string {
  return v == null ? "" : String(v);
}
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}
function triBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

/** Costruisce lo stato del form da una riga DB (per il pre-compilato). */
export function rowToForm(row: DossierRow | null | undefined): DossierForm {
  const form = emptyDossierForm();
  if (!row) return form;

  form.nome = str(row.nome);
  form.eta = str(row.eta);
  form.sesso = str(row.sesso);
  form.altezza_cm = str(row.altezza_cm);
  form.peso_dichiarato_kg = str(row.peso_dichiarato_kg);
  form.sport_principali = strArray(row.sport_principali);
  form.livello_esperienza = str(row.livello_esperienza);
  form.obiettivi = str(row.obiettivi);

  const gara = (row.gare_target ?? null) as Partial<GaraTarget> | null;
  if (gara) {
    form.gara = {
      nome: str(gara.nome),
      data: str(gara.data),
      distanza_km: gara.distanza_km == null ? "" : String(gara.distanza_km),
      dislivello_m: gara.dislivello_m == null ? "" : String(gara.dislivello_m),
    };
  }

  form.disponibilita_ore_sett = str(row.disponibilita_ore_sett);
  form.giorni_preferiti = strArray(row.giorni_preferiti);
  form.giorni_impossibili = strArray(row.giorni_impossibili);
  form.durata_max_weekday_min = str(row.durata_max_weekday_min);
  form.durata_max_weekend_min = str(row.durata_max_weekend_min);
  form.indoor_outdoor = str(row.indoor_outdoor);
  form.ha_rulli = triBool(row.ha_rulli);
  form.ha_misuratore_potenza = triBool(row.ha_misuratore_potenza);
  form.ha_fascia_cardio = triBool(row.ha_fascia_cardio);
  form.ha_smartwatch = triBool(row.ha_smartwatch);
  form.infortuni_attuali = str(row.infortuni_attuali);
  form.dolore_attuale = str(row.dolore_attuale);
  form.preferenze_allenamento = str(row.preferenze_allenamento);
  form.limiti_principali = str(row.limiti_principali);
  form.note_personali = str(row.note_personali);

  return form;
}

/** "" → null; altrimenti il testo trimmato. */
function nullableText(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}
/** "" / non numerico → null; intero altrimenti. */
function nullableInt(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}
/** "" / non numerico → null; numero (anche decimale) altrimenti. */
function nullableNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Converte il form nel patch da inviare alla API (solo colonne whitelisted,
 * tipi DB). Le liste vuote diventano null per non sovrascrivere con []
 * involontariamente; le tristate non risposte restano null.
 */
export function formToPatch(form: DossierForm): Record<DossierColumn, unknown> {
  const garaCompilata =
    form.gara.nome.trim() !== "" ||
    form.gara.data.trim() !== "" ||
    form.gara.distanza_km.trim() !== "" ||
    form.gara.dislivello_m.trim() !== "";

  const gara: GaraTarget | null = garaCompilata
    ? {
        nome: form.gara.nome.trim(),
        data: form.gara.data.trim(),
        distanza_km: nullableNum(form.gara.distanza_km),
        dislivello_m: nullableInt(form.gara.dislivello_m),
      }
    : null;

  return {
    nome: nullableText(form.nome),
    eta: nullableInt(form.eta),
    sesso: nullableText(form.sesso),
    altezza_cm: nullableInt(form.altezza_cm),
    peso_dichiarato_kg: nullableNum(form.peso_dichiarato_kg),
    sport_principali:
      form.sport_principali.length > 0 ? form.sport_principali : null,
    livello_esperienza: nullableText(form.livello_esperienza),
    obiettivi: nullableText(form.obiettivi),
    gare_target: gara,
    // data_obiettivo segue la data della gara target principale (§12.2).
    data_obiettivo: gara && gara.data !== "" ? gara.data : null,
    disponibilita_ore_sett: nullableNum(form.disponibilita_ore_sett),
    giorni_preferiti:
      form.giorni_preferiti.length > 0 ? form.giorni_preferiti : null,
    giorni_impossibili:
      form.giorni_impossibili.length > 0 ? form.giorni_impossibili : null,
    durata_max_weekday_min: nullableInt(form.durata_max_weekday_min),
    durata_max_weekend_min: nullableInt(form.durata_max_weekend_min),
    indoor_outdoor: nullableText(form.indoor_outdoor),
    ha_rulli: form.ha_rulli,
    ha_misuratore_potenza: form.ha_misuratore_potenza,
    ha_fascia_cardio: form.ha_fascia_cardio,
    ha_smartwatch: form.ha_smartwatch,
    infortuni_attuali: nullableText(form.infortuni_attuali),
    dolore_attuale: nullableText(form.dolore_attuale),
    preferenze_allenamento: nullableText(form.preferenze_allenamento),
    limiti_principali: nullableText(form.limiti_principali),
    note_personali: nullableText(form.note_personali),
  };
}
