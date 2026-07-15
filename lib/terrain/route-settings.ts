import type { Climb } from "@/lib/terrain/gpx-parser";

/**
 * Impostazioni percorso/strategia (M1 Race Planner) — funzioni PURE, no I/O.
 *
 * Cataloghi CdA/Crr/margine di ripetibilità (stesso stile di
 * velocity-signature.ts: costanti documentate con fonte in commento). Valori
 * marcati **v0**: tarabili, non ancora validati su dati reali. `RaceEstimateOpts`
 * vive qui (non in race-estimator-v2.ts) per evitare un import circolare, dato
 * che `routeSettingsToOpts` deve importare `Climb` da gpx-parser e produrre
 * l'oggetto opts consumato da race-estimator-v2.ts.
 */

// --- 3a. Posizioni in sella → CdA (m²) ---------------------------------------

export type RidingPositionKey =
  | "tops"
  | "hoods"
  | "drops"
  | "aero"
  | "standing"
  | "mtb_bar";

/**
 * Fonte: valori CdA di riferimento da letteratura ciclistica standard (range
 * tipici road: aero ~0.20–0.25, drops ~0.28–0.32, hoods ~0.34–0.40, tops/upright
 * ~0.40+; MTB seduto ~0.36–0.42). **v0**, tarabili. NB: la costante attuale
 * CDA=0.6 in race-estimator.ts è un valore MTB "grezzo"; questi sono più
 * realistici per posizione — l'effetto sui tempi resta minimo perché il CdA
 * conta solo dove la fisica pura guida la stima (vedi OPEN QUESTION 2 nella
 * spec: sostanzialmente solo tratti piano/discesa, MAI in salita >3%).
 */
export const RIDING_POSITIONS: Array<{
  key: RidingPositionKey;
  label: string;
  cda_m2: number;
}> = [
  { key: "tops", label: "Manubrio piano (parte alta)", cda_m2: 0.4 },
  { key: "hoods", label: "Sulle leve", cda_m2: 0.36 },
  { key: "mtb_bar", label: "Manubrio MTB / bar ends", cda_m2: 0.38 },
  { key: "drops", label: "Presa bassa", cda_m2: 0.3 },
  { key: "aero", label: "Appoggi aero", cda_m2: 0.24 },
  { key: "standing", label: "In piedi / fuori sella", cda_m2: 0.42 },
];

const DEFAULT_RIDING_POSITION: RidingPositionKey = "hoods";
const CDA_MIN = 0.15;
const CDA_MAX = 0.6;

// --- 3b. Fondo salita → Crr ---------------------------------------------------

export type SurfaceKey =
  | "asphalt_smooth"
  | "asphalt_rough"
  | "gravel_firm"
  | "gravel_loose"
  | "trail_rough" // sentiero sconnesso, sassoso
  | "roots_rocks" // radici e pietre affioranti
  | "rocky_field" // pietraia
  | "deep_mud"; // fango profondo

/**
 * Fonte: Crr di riferimento da letteratura (asfalto liscio ~0.004–0.005,
 * asfalto ruvido ~0.006–0.008, sterrato compatto ~0.010–0.012, sterrato
 * sconnesso/gravel ~0.015–0.018). **v0**. NB: la costante attuale CRR=0.02 in
 * race-estimator.ts è MTB pieno fuoristrada; il default asphalt_rough la
 * abbassa — comportamento voluto (il fondo lo sceglie l'utente per salita).
 * Crr fondi estremi MTB **v0, grezzi**: la letteratura è scarsa e molto
 * variabile per fuoristrada severo, dove il "Crr effettivo" assorbe anche
 * impatti e sprofondamento oltre al rotolamento puro. Ordine di grandezza
 * plausibile: sentiero sconnesso ~0.02–0.03, radici/pietre ~0.03–0.04,
 * pietraia ~0.04–0.05, fango profondo ~0.05–0.07. Tarabili.
 */
export const SURFACES: Array<{ key: SurfaceKey; label: string; crr: number }> = [
  { key: "asphalt_smooth", label: "Asfalto liscio", crr: 0.005 },
  { key: "asphalt_rough", label: "Asfalto ruvido", crr: 0.007 },
  { key: "gravel_firm", label: "Sterrato compatto", crr: 0.011 },
  { key: "gravel_loose", label: "Sterrato sconnesso / gravel", crr: 0.016 },
  { key: "trail_rough", label: "Sentiero sconnesso / sassoso", crr: 0.025 },
  { key: "roots_rocks", label: "Radici e pietre", crr: 0.035 },
  { key: "rocky_field", label: "Pietraia", crr: 0.045 },
  { key: "deep_mud", label: "Fango profondo", crr: 0.06 },
];
export const DEFAULT_SURFACE: SurfaceKey = "asphalt_rough";

/**
 * Crr di riferimento implicito della firma dell'atleta (M1.1): le uscite MTB
 * che alimentano velocity-signature.ts sono pedalate su fondo misto/sterrato,
 * qui approssimato a `gravel_firm` (0.011). Serve da base per `surfaceFactor`:
 * scegliere gravel_firm per una salita → correzione 1.0 (nessun cambiamento
 * rispetto a oggi). **v0**, tarabile (OPEN QUESTION 1 M1.1).
 */
export const SIGNATURE_REF_CRR = 0.011;

const SURFACE_FACTOR_MIN = 0.5;
const SURFACE_FACTOR_MAX = 1.5;

/**
 * Fattore v0 di correzione velocità del bucket per fondo diverso dal riferimento della firma.
 * Derivazione: P≈m·g·v·(grad+Crr) a P costante → V_new/V_ref = (grad+crrRef)/(grad+crrNew).
 * Valido SOLO in salita (aero trascurata). Clampato a [0.5, 1.5]. v0/tarabile.
 */
export function surfaceFactor(gradientFrac: number, crrRef: number, crrNew: number): number {
  const raw = (gradientFrac + crrRef) / (gradientFrac + crrNew);
  return clamp(raw, SURFACE_FACTOR_MIN, SURFACE_FACTOR_MAX);
}

/**
 * Peso bici di riferimento implicito della firma dell'atleta (M1.2): le uscite
 * MTB che alimentano velocity-signature.ts sono pedalate su una MTB reale, il
 * cui peso non è tracciato da nessuna parte — va quindi assunto come costante
 * v0, come SIGNATURE_REF_CRR. 13 kg è un peso MTB tipico ragionevole, ancorato
 * anche all'archetipo (Rampichilonero 2024). Serve da base per `massFactor`:
 * bici a 13 kg → correzione 1.0 (nessun cambiamento rispetto a oggi). **v0**,
 * tarabile (OPEN QUESTION 1 M1.2).
 */
export const SIGNATURE_REF_BIKE_KG = 13;

const MASS_FACTOR_MIN = 0.7;
const MASS_FACTOR_MAX = 1.3;

/**
 * Fattore v0 di correzione velocità del bucket per massa totale diversa dal riferimento della firma.
 * Derivazione: P≈m·g·v·(grad+Crr) a P e Crr costanti → V_new/V_ref = m_ref/m_new.
 * Corregge SOLO la differenza di peso BICI (il peso atleta si semplifica: i bucket sono velocità
 * pure, mai normalizzate per il peso atleta, quindi non c'è un peso atleta di riferimento da
 * correggere). Valido SOLO in salita (aero trascurata). Clampato a [0.7, 1.3]. v0/tarabile.
 */
export function massFactor(massRef: number, massNew: number): number {
  const raw = massRef / massNew;
  return clamp(raw, MASS_FACTOR_MIN, MASS_FACTOR_MAX);
}

// --- 3c. Margine di ripetibilità ----------------------------------------------

export const REPEATABILITY_PRESETS: Array<{
  key: string;
  label: string;
  frac: number;
}> = [
  { key: "aggressive", label: "Aggressivo", frac: 1.0 },
  { key: "controlled", label: "Controllato", frac: 0.95 },
  { key: "conservative", label: "Conservativo", frac: 0.9 },
];

const REPEATABILITY_MIN = 0.85;
const REPEATABILITY_MAX = 1.0;
const DEFAULT_REPEATABILITY = 1.0;

const BIKE_WEIGHT_MAX_KG = 30;

// --- Tipi ---------------------------------------------------------------------

export interface RaceRouteSettings {
  /** Peso bici in kg (0 escluso, cap ragionevole). null = non impostato. */
  bike_weight_kg: number | null;
  /** Chiave posizione in sella (vedi RIDING_POSITIONS) oppure "custom". */
  riding_position: RidingPositionKey | "custom";
  /** CdA effettivo (m²): dalla posizione scelta o inserito a mano se "custom". */
  cda_m2: number;
  /**
   * Crr per salita, indicizzato per INDICE della salita in terrain.climbs.
   * Chiave = indice (stringa, JSONB), valore = SurfaceKey. Salite non presenti
   * usano il default. Le chiavi possono restare "orfane" se il percorso cambia:
   * si leggono per indice, gli extra si ignorano.
   */
  climb_surfaces: Record<string, SurfaceKey>;
  /** Margine di ripetibilità: moltiplicatore potenza globale 0.85–1.0. */
  repeatability_frac: number;
}

/** Opzioni fisiche derivate da RaceRouteSettings, consumate da race-estimator-v2.ts. */
export interface RaceEstimateOpts {
  cda_m2?: number; // default CDA (0.6)
  bike_weight_kg?: number; // sommato a weightKg → massa totale. default 0
  repeatability_frac?: number; // moltiplicatore globale powerFraction. default 1.0
  /** Crr per indice-salita (già risolto a numero). undefined → CRR default. */
  climb_crr?: number[]; // climb_crr[i] = crr della climbs[i]
  /** Fondo scelto per indice-salita (solo per popolare climb_estimates.surface). */
  climb_surface?: SurfaceKey[];
}

// --- 3d. Helper puri ------------------------------------------------------------

export function cdaForPosition(key: RidingPositionKey): number {
  return RIDING_POSITIONS.find((p) => p.key === key)?.cda_m2 ?? cdaForPosition(DEFAULT_RIDING_POSITION);
}

export function crrForSurface(key: SurfaceKey): number {
  return SURFACES.find((s) => s.key === key)?.crr ?? crrForSurface(DEFAULT_SURFACE);
}

/** Fondo scelto per la salita all'indice `climbIndex`, o il default. */
export function surfaceForClimb(
  settings: RaceRouteSettings,
  climbIndex: number
): SurfaceKey {
  return settings.climb_surfaces[String(climbIndex)] ?? DEFAULT_SURFACE;
}

export function defaultRouteSettings(): RaceRouteSettings {
  return {
    bike_weight_kg: null,
    riding_position: DEFAULT_RIDING_POSITION,
    cda_m2: cdaForPosition(DEFAULT_RIDING_POSITION),
    climb_surfaces: {},
    repeatability_frac: DEFAULT_REPEATABILITY,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** true se un candidato è una SurfaceKey valida. */
function isSurfaceKey(value: unknown): value is SurfaceKey {
  return typeof value === "string" && SURFACES.some((s) => s.key === value);
}

/** true se un candidato è una RidingPositionKey valida. */
function isRidingPositionKey(value: unknown): value is RidingPositionKey {
  return typeof value === "string" && RIDING_POSITIONS.some((p) => p.key === value);
}

/**
 * Coerce + clamp di un input non fidato (route POST, o profile_data letto dal
 * DB) in RaceRouteSettings valido. Non lancia mai: input assente/malformato →
 * defaultRouteSettings() o valori clampati/fallback.
 */
export function sanitizeRouteSettings(raw: unknown): RaceRouteSettings {
  const base = defaultRouteSettings();
  if (raw == null || typeof raw !== "object") return base;
  const src = raw as Record<string, unknown>;

  // bike_weight_kg: negativo/NaN → null; cap a BIKE_WEIGHT_MAX_KG.
  let bikeWeightKg: number | null = null;
  if (typeof src.bike_weight_kg === "number" && Number.isFinite(src.bike_weight_kg)) {
    bikeWeightKg = src.bike_weight_kg < 0 ? null : Math.min(src.bike_weight_kg, BIKE_WEIGHT_MAX_KG);
  }

  // riding_position: chiave valida o "custom", altrimenti default.
  const ridingPosition: RidingPositionKey | "custom" =
    src.riding_position === "custom"
      ? "custom"
      : isRidingPositionKey(src.riding_position)
        ? src.riding_position
        : base.riding_position;

  // cda_m2: clamp [0.15, 0.60]; NaN → CdA della posizione risolta (o default hoods).
  const fallbackCda =
    ridingPosition === "custom" ? cdaForPosition(DEFAULT_RIDING_POSITION) : cdaForPosition(ridingPosition);
  const cdaM2 =
    typeof src.cda_m2 === "number" && Number.isFinite(src.cda_m2)
      ? clamp(src.cda_m2, CDA_MIN, CDA_MAX)
      : fallbackCda;

  // climb_surfaces: solo chiavi indice-numeriche con valori SurfaceKey validi.
  const climbSurfaces: Record<string, SurfaceKey> = {};
  if (src.climb_surfaces != null && typeof src.climb_surfaces === "object") {
    for (const [k, v] of Object.entries(src.climb_surfaces as Record<string, unknown>)) {
      if (Number.isInteger(Number(k)) && Number(k) >= 0 && isSurfaceKey(v)) {
        climbSurfaces[k] = v;
      }
    }
  }

  // repeatability_frac: clamp [0.85, 1.0]; NaN → 1.0.
  const repeatabilityFrac =
    typeof src.repeatability_frac === "number" && Number.isFinite(src.repeatability_frac)
      ? clamp(src.repeatability_frac, REPEATABILITY_MIN, REPEATABILITY_MAX)
      : DEFAULT_REPEATABILITY;

  return {
    bike_weight_kg: bikeWeightKg,
    riding_position: ridingPosition,
    cda_m2: cdaM2,
    climb_surfaces: climbSurfaces,
    repeatability_frac: repeatabilityFrac,
  };
}

/**
 * Costruisce l'oggetto opts per la fisica (race-estimator-v2.ts) da impostazioni
 * già sanificate + le salite del percorso corrente. Risolve climb_crr/
 * climb_surface per indice: salite senza fondo scelto usano DEFAULT_SURFACE.
 */
export function routeSettingsToOpts(
  settings: RaceRouteSettings,
  climbs: Climb[]
): RaceEstimateOpts {
  const climbSurface: SurfaceKey[] = climbs.map((_, i) => surfaceForClimb(settings, i));
  const climbCrr: number[] = climbSurface.map((s) => crrForSurface(s));

  return {
    cda_m2: settings.cda_m2,
    bike_weight_kg: settings.bike_weight_kg ?? 0,
    repeatability_frac: settings.repeatability_frac,
    climb_crr: climbCrr,
    climb_surface: climbSurface,
  };
}
