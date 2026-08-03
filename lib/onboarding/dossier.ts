import { prevailingAxis } from "@/lib/coaching/schools";

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
 * Risposte dell'intervista sulla filosofia di coaching (migration 023,
 * athlete_profiles.filosofia_risposte JSONB). Tutti i campi sono stringhe o
 * liste di stringhe: la forma del form e quella del DB coincidono, non serve
 * conversione. Le domande che il dossier fa già altrove (gara, obiettivi,
 * infortuni, ore disponibili) NON si ripetono qui.
 */
export interface FilosofiaForm {
  /** id di lib/coaching/schools.ts. Vuoto = "non ne conosco". */
  scuole: string[];
  /** Cosa ha funzionato e cosa è fallito negli anni passati. */
  storia: string;
  blocchi_duri: string; // "" | "mi_caricano" | "reggo_poi_crollo" | "li_evito"
  struttura: string; // "" | "struttura" | "flessibilita" | "misto"
  dati_sensazioni: string; // "" | "dati" | "sensazioni" | "misto"
  tono: string; // "" | "duro" | "diretto" | "incoraggiante"
  piace: string[];
  detesta: string[];
}

/**
 * Stato del form: tutti i campi sono stringhe (input controllati) tranne le
 * liste e le tristate sì/no. La conversione ai tipi DB avviene in formToPatch.
 */
export interface DossierForm {
  // Step 5 — Chi sei
  sport_principali: string[]; // esclusivo: ["Ciclismo"] | ["Corsa"] | []
  nome: string;
  eta: string;
  sesso: string; // "" | "M" | "F" | "other"
  livello_esperienza: string; // "" | "beginner" | "intermediate" | "advanced"
  // Step 6 — Obiettivi
  obiettivi: string;
  gara: GaraTargetForm;
  // Step 7 — La tua settimana
  disponibilita_ore_sett: string;
  durata_max_weekday_min: string;
  durata_max_weekend_min: string;
  giorni_preferiti: string[];
  giorni_impossibili: string[];
  ha_rulli: boolean | null; // solo ciclismo
  indoor_outdoor: string; // solo ciclismo — "" | "indoor" | "outdoor" | "both"
  // Step 8 — Salute e note
  infortuni_attuali: string;
  dolore_attuale: string;
  farmaci_integratori: string;
  limiti_principali: string;
  note_personali: string;
  // Step 9 — La tua filosofia
  filosofia: FilosofiaForm;
  stile_allenamento: string;
}

/** Periodo di infortunio dichiarato dall'atleta. */
export interface InjuryPeriod {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  note?: string;
}

/** Versione "stringhe" della gara target, per gli input controllati. */
export interface GaraTargetForm {
  nome: string;
  data: string;
  distanza_km: string;
  dislivello_m: string;
}

// --- Opzioni di scelta -------------------------------------------------------

/**
 * Sport esclusivo (step 5): sceglie tra ciclismo e corsa, mai entrambi. Guida
 * cosa chiede il resto del wizard (indoor/rulli solo bici) e il blocco onesto
 * di /api/planner/generate (la libreria sedute oggi è solo ciclismo).
 */
export const SPORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "Ciclismo", label: "Ciclismo" },
  { value: "Corsa", label: "Corsa" },
];

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

export const STILE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "polarized", label: "Polarizzato (molto facile + molto intenso)" },
  { value: "pyramidal", label: "Piramidale (prevalenza Z2-Z3)" },
  { value: "threshold", label: "Soglia (sweetspot / threshold)" },
  { value: "mixed", label: "Misto / non lo so ancora" },
];

// --- Opzioni dell'intervista sulla filosofia (step 9) ------------------------
// I `value` sono chiavi stabili: alcuni li legge traitsFromAnswers() in
// lib/coaching/schools.ts per suggerire le scuole a chi non ne conosce nessuna.

export const BLOCCHI_DURI_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "mi_caricano", label: "Mi caricano: più è dura, più mi diverto" },
  { value: "reggo_poi_crollo", label: "Li reggo, ma dopo qualche settimana crollo" },
  { value: "li_evito", label: "Li evito: preferisco la costanza ai picchi di fatica" },
];

export const STRUTTURA_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "struttura", label: "Struttura: dimmi esattamente cosa fare e quando" },
  { value: "flessibilita", label: "Flessibilità: dammi la direzione, il giorno lo scelgo io" },
  { value: "misto", label: "Un po' e un po'" },
];

export const DATI_SENSAZIONI_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "dati", label: "Dati: watt, zone, numeri" },
  { value: "sensazioni", label: "Sensazioni: come mi sento quel giorno" },
  { value: "misto", label: "Guardo i numeri ma decido a sensazione" },
];

export const TONO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "duro", label: "Duro: dimmi quando sbaglio, senza giri di parole" },
  { value: "diretto", label: "Diretto: i fatti, niente pacche sulle spalle" },
  { value: "incoraggiante", label: "Incoraggiante: motivami, spingimi col positivo" },
];

/** Tipi di seduta, per le due liste "cosa ti piace" / "cosa detesti". */
export const ALLENAMENTI_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "lungo", label: "Uscite lunghe" },
  { value: "salite", label: "Salite" },
  { value: "intervalli_brevi", label: "Intervalli brevi" },
  { value: "intervalli_lunghi", label: "Intervalli lunghi" },
  { value: "soglia", label: "Soglia / sweet spot" },
  { value: "indoor", label: "Rulli / indoor" },
  { value: "gruppo", label: "Uscite in gruppo" },
  { value: "recupero", label: "Sedute di recupero" },
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
export const LAST_STEP = 10;

export const STEP_LABELS: Record<number, string> = {
  3: "Consenso privacy",
  4: "Come funziona",
  5: "Chi sei",
  6: "Obiettivi",
  7: "La tua settimana",
  8: "Salute e note",
  9: "La tua filosofia",
  10: "Prima analisi",
};

// --- Mappatura DB ⇄ form -----------------------------------------------------

/**
 * Colonne di athlete_profiles scrivibili dal dossier (whitelist per la API).
 * Solo campi con un consumer verificato (planner, profilo, context AI) —
 * altezza/peso/parametri fisiologici dichiarati/attrezzatura sono stati
 * rimossi (migration 024): quei numeri arrivano da Intervals, non dal wizard.
 */
export const DOSSIER_COLUMNS = [
  "nome",
  "eta",
  "sesso",
  "sport_principali",
  "livello_esperienza",
  "obiettivi",
  "stile_allenamento",
  "gare_target",
  "data_obiettivo",
  "disponibilita_ore_sett",
  "durata_max_weekday_min",
  "durata_max_weekend_min",
  "giorni_preferiti",
  "giorni_impossibili",
  "ha_rulli",
  "indoor_outdoor",
  "injury_periods",
  "infortuni_attuali",
  "dolore_attuale",
  "farmaci_integratori",
  "limiti_principali",
  "note_personali",
  "filosofia_risposte",
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

const EMPTY_FILOSOFIA: FilosofiaForm = {
  scuole: [],
  storia: "",
  blocchi_duri: "",
  struttura: "",
  dati_sensazioni: "",
  tono: "",
  piace: [],
  detesta: [],
};

export function emptyDossierForm(): DossierForm {
  return {
    // Nessun default: la scelta sport è obbligatoria (canAdvanceStep5).
    sport_principali: [],
    nome: "",
    eta: "",
    sesso: "",
    livello_esperienza: "",
    obiettivi: "",
    gara: { ...EMPTY_GARA },
    disponibilita_ore_sett: "",
    durata_max_weekday_min: "",
    durata_max_weekend_min: "",
    giorni_preferiti: [],
    giorni_impossibili: [],
    ha_rulli: null,
    indoor_outdoor: "",
    infortuni_attuali: "",
    dolore_attuale: "",
    farmaci_integratori: "",
    limiti_principali: "",
    note_personali: "",
    filosofia: { ...EMPTY_FILOSOFIA },
    stile_allenamento: "",
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

  form.sport_principali = strArray(row.sport_principali);
  form.nome = str(row.nome);
  form.eta = str(row.eta);
  form.sesso = str(row.sesso);
  form.livello_esperienza = str(row.livello_esperienza);
  form.obiettivi = str(row.obiettivi);
  form.stile_allenamento = str(row.stile_allenamento);

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
  form.durata_max_weekday_min = str(row.durata_max_weekday_min);
  form.durata_max_weekend_min = str(row.durata_max_weekend_min);
  form.giorni_preferiti = strArray(row.giorni_preferiti);
  form.giorni_impossibili = strArray(row.giorni_impossibili);
  form.ha_rulli = triBool(row.ha_rulli);
  form.indoor_outdoor = str(row.indoor_outdoor);

  form.infortuni_attuali = str(row.infortuni_attuali);
  form.dolore_attuale = str(row.dolore_attuale);
  form.farmaci_integratori = str(row.farmaci_integratori);
  form.limiti_principali = str(row.limiti_principali);
  form.note_personali = str(row.note_personali);

  const filosofia = (row.filosofia_risposte ?? null) as Partial<FilosofiaForm> | null;
  if (filosofia) {
    form.filosofia = {
      scuole: strArray(filosofia.scuole),
      storia: str(filosofia.storia),
      blocchi_duri: str(filosofia.blocchi_duri),
      struttura: str(filosofia.struttura),
      dati_sensazioni: str(filosofia.dati_sensazioni),
      tono: str(filosofia.tono),
      piace: strArray(filosofia.piace),
      detesta: strArray(filosofia.detesta),
    };
  }

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

  const f = form.filosofia;
  const filosofiaCompilata =
    f.scuole.length > 0 ||
    f.piace.length > 0 ||
    f.detesta.length > 0 ||
    [f.storia, f.blocchi_duri, f.struttura, f.dati_sensazioni, f.tono].some(
      (v) => v.trim() !== ""
    );

  // Le scuole scelte hanno l'ultima parola sullo stile: è il valore che poi
  // pilota la seduta dura in lib/planner/session-selector.ts. Senza scuole
  // resta quello scelto esplicitamente qui sotto (stile_allenamento).
  const stileDalleScuole = f.scuole.length > 0 ? prevailingAxis(f.scuole) : null;

  return {
    sport_principali: form.sport_principali.length > 0 ? form.sport_principali : null,
    nome: nullableText(form.nome),
    eta: nullableInt(form.eta),
    sesso: nullableText(form.sesso),
    livello_esperienza: nullableText(form.livello_esperienza),
    obiettivi: nullableText(form.obiettivi),
    stile_allenamento: stileDalleScuole ?? nullableText(form.stile_allenamento),
    gare_target: gara,
    data_obiettivo: gara && gara.data !== "" ? gara.data : null,
    disponibilita_ore_sett: nullableNum(form.disponibilita_ore_sett),
    durata_max_weekday_min: nullableInt(form.durata_max_weekday_min),
    durata_max_weekend_min: nullableInt(form.durata_max_weekend_min),
    giorni_preferiti: form.giorni_preferiti.length > 0 ? form.giorni_preferiti : null,
    giorni_impossibili: form.giorni_impossibili.length > 0 ? form.giorni_impossibili : null,
    ha_rulli: form.ha_rulli,
    indoor_outdoor: nullableText(form.indoor_outdoor),
    injury_periods: undefined, // gestito dalla UI settings, non dal wizard dossier
    infortuni_attuali: nullableText(form.infortuni_attuali),
    dolore_attuale: nullableText(form.dolore_attuale),
    farmaci_integratori: nullableText(form.farmaci_integratori),
    limiti_principali: nullableText(form.limiti_principali),
    note_personali: nullableText(form.note_personali),
    filosofia_risposte: filosofiaCompilata
      ? { ...f, storia: f.storia.trim() }
      : null,
  };
}
