import type { AthleteProfileData } from "@/lib/profile/build-profile";
import type { Climb, TerrainSummary } from "@/lib/terrain/gpx-parser";

/**
 * Gap analysis evento target (PRD §33 C.6) — funzioni PURE.
 *
 * Confronta la DOMANDA del percorso (salite rilevate da gpx-parser) col
 * fenotipo dell'atleta usando SOLO valori già calcolati in profile_data
 * (CP/W′, RPP, peso) più il CTL corrente. Non chiama AI, non inventa numeri:
 * stima durata e fatica con modelli fisici dichiarati e li dichiara come
 * STIME nell'output. Mappa ogni limitatore su una leva e su sedute della
 * Workout Library (PRD §33 E) — i riferimenti seduta sono etichette, la
 * selezione vera arriverà dal planner Section 11.
 */

// --- Costanti dei modelli di stima (v0, dichiarate) --------------------------

const BIKE_MASS_KG = 10; // MTB + accessori (stima)
const GRAVITY = 9.81;
const CRR = 0.012; // resistenza al rotolamento su sterrato (stima)

/** Fattore di tenuta della potenza per livello di fatica (durabilità, v0). */
const FATIGUE_FACTOR: Record<FatigueLevel, number> = {
  fresh: 1.0,
  moderate: 0.95,
  fatigued: 0.88,
};

/** Soglie di severità sul gap in W/kg (v0). */
const GAP_HIGH_WKG = 0.4;
const GAP_MEDIUM_WKG = 0.15;

/** Soglie "punch debole" per i limitatori neuromuscolari/W′ (v0). */
const LOW_WPRIME_KJ = 15;
const LOW_APR_RATIO = 2.0;

export type DemandType = "long_sustained" | "medium_effort" | "short_punch";
export type FatigueLevel = "fresh" | "moderate" | "fatigued";
export type Severity = "high" | "medium" | "low";

export interface ClimbDemand {
  /** position_km del climb in terrainSummary (chiave di join con la geometria). */
  climb_ref: number;
  est_duration_s: number | null;
  demand_type: DemandType;
  has_steep_pitch: boolean;
  fatigue_level: FatigueLevel;
  est_kjkg: number | null;
}

export interface Limiter {
  name: string;
  climb_ref: number;
  /** Tutte le salite del gruppo (1 sola se non aggregato). */
  climb_refs: number[];
  demand_type: DemandType;
  fatigue_level: FatigueLevel;
  required_wkg: number | null;
  athlete_wkg: number | null;
  gap_wkg: number | null;
  severity: Severity;
  training_lever: string;
  workout_library_refs: string[];
  evidence: string;
  est_duration_s: number | null;
}

export interface GapAnalysisResult {
  climb_demands: ClimbDemand[];
  limiters: Limiter[];
  /** Nota quando mancano dati per la parte numerica (es. CP assente). */
  note: string | null;
}

// --- estimateClimbDuration ---------------------------------------------------

/**
 * Stima la durata (s) di una salita: velocità attesa dalla potenza sostenibile
 * (CP) contro gravità + rotolamento. Aero trascurata (salita lenta).
 * v = P / (m·g·(pendenza + Crr)). Ritorna null se mancano CP o peso.
 */
export function estimateClimbDuration(
  climb: Climb,
  cpW: number | null,
  weightKg: number | null
): number | null {
  if (cpW == null || weightKg == null || cpW <= 0 || weightKg <= 0) return null;
  const grade = climb.avg_gradient_pct / 100;
  const mass = weightKg + BIKE_MASS_KG;
  const resistiveCoeff = grade + CRR;
  if (resistiveCoeff <= 0) return null;
  const speed_mps = cpW / (mass * GRAVITY * resistiveCoeff);
  if (speed_mps <= 0) return null;
  const distance_m = climb.distance_km * 1000;
  return Math.round(distance_m / speed_mps);
}

// --- classifyDemand ----------------------------------------------------------

/** Dalla durata stimata e dalla pendenza classifica la domanda della salita. */
export function classifyDemand(
  climb: Climb,
  estimatedDurationSecs: number | null
): { demand_type: DemandType; has_steep_pitch: boolean } {
  const has_steep_pitch = climb.max_gradient_pct >= 8;
  // Senza durata stimata si ripiega sulla geometria: salite lunghe (≥3 km o
  // ≥250 m D+) come long_sustained, altrimenti medium.
  const dur =
    estimatedDurationSecs ??
    (climb.distance_km >= 3 || climb.elevation_m >= 250 ? 1400 : 600);

  let demand_type: DemandType;
  if (dur > 1200) demand_type = "long_sustained";
  else if (dur >= 300) demand_type = "medium_effort";
  else demand_type = "short_punch";

  return { demand_type, has_steep_pitch };
}

// --- estimateFatigue ---------------------------------------------------------

/**
 * Stima la fatica al punto della salita: frazione di percorso percorsa →
 * kJ/kg cumulati attesi (approssimazione lineare con CTL corrente come proxy
 * di carico, PRD §33 C.6). fatigue_level a soglie di frazione (v0).
 */
export function estimateFatigue(
  climb: Climb,
  total_distance_km: number,
  ctlToday: number | null
): { fatigue_level: FatigueLevel; est_kjkg: number | null } {
  const fraction =
    total_distance_km > 0
      ? Math.min(1, Math.max(0, climb.position_km / total_distance_km))
      : 0;
  const fatigue_level: FatigueLevel =
    fraction < 0.33 ? "fresh" : fraction < 0.66 ? "moderate" : "fatigued";
  const est_kjkg = ctlToday != null ? Number((ctlToday * fraction).toFixed(1)) : null;
  return { fatigue_level, est_kjkg };
}

// --- computeGapAnalysis ------------------------------------------------------

/** RPP wkg alla durata più vicina a `targetSecs` (solo punti con wkg valido). */
function nearestRppWkg(
  profile: AthleteProfileData,
  targetSecs: number
): number | null {
  let best: { wkg: number; diff: number } | null = null;
  for (const p of profile.rpp) {
    if (p.wkg == null) continue;
    const diff = Math.abs(p.duration_s - targetSecs);
    if (best == null || diff < best.diff) best = { wkg: p.wkg, diff };
  }
  return best?.wkg ?? null;
}

function severityFromGap(
  gap: number,
  fatigue: FatigueLevel
): Severity {
  let sev: Severity = gap >= GAP_HIGH_WKG ? "high" : gap >= GAP_MEDIUM_WKG ? "medium" : "low";
  // A fatica un gap anche piccolo conta di più (durabilità è il limitatore vero).
  if (fatigue === "fatigued" && gap >= 0.1 && sev === "low") sev = "medium";
  return sev;
}

/**
 * Costruisce il limitatore per una salita confrontando la domanda col profilo.
 * Per salite sostenute/medie il confronto è numerico (CP vs RPP a fatica); per
 * gli strappi brevi/ripidi la severità deriva da W′ e APR.
 */
function buildLimiter(
  climb: Climb,
  demand: ClimbDemand,
  profile: AthleteProfileData
): Limiter {
  const cpWkg = profile.cp_wprime?.cp_wkg ?? null;
  const wPrimeKj = profile.cp_wprime?.w_prime_kj ?? null;
  const aprRatio = profile.apr?.apr_ratio ?? null;
  const factor = FATIGUE_FACTOR[demand.fatigue_level];

  const base = {
    climb_ref: demand.climb_ref,
    climb_refs: [demand.climb_ref],
    demand_type: demand.demand_type,
    fatigue_level: demand.fatigue_level,
    est_duration_s: demand.est_duration_s,
  };

  if (demand.demand_type === "short_punch") {
    // Strappo breve/ripido: la leva è W′/neuromuscolare, non la soglia.
    const weakPunch =
      (wPrimeKj != null && wPrimeKj < LOW_WPRIME_KJ) ||
      (aprRatio != null && aprRatio < LOW_APR_RATIO);
    const steepHard = demand.has_steep_pitch && climb.max_gradient_pct >= 10;
    const severity: Severity = weakPunch && steepHard ? "high" : weakPunch || steepHard ? "medium" : "low";

    if (demand.has_steep_pitch) {
      return {
        ...base,
        name: "Pitch ripido neuromuscolare",
        required_wkg: null,
        athlete_wkg: null,
        gap_wkg: null,
        severity,
        training_lever: "neuromuscular",
        workout_library_refs: ["sprint 8–12×10–15\""],
        evidence: `Strappo ripido (max ~${climb.max_gradient_pct}% attenuato) ${
          wPrimeKj != null ? `· W′ ${wPrimeKj.toFixed(1)} kJ` : ""
        }`.trim(),
      };
    }
    return {
      ...base,
      name: "Strappo breve ripetuto",
      required_wkg: null,
      athlete_wkg: null,
      gap_wkg: null,
      severity,
      training_lever: "wprime_reconstitution",
      workout_library_refs: ["over-under", "30/15"],
      evidence:
        wPrimeKj != null
          ? `Ripetibilità sopra soglia · W′ ${wPrimeKj.toFixed(1)} kJ`
          : "Ripetibilità sopra soglia",
    };
  }

  // long_sustained / medium_effort: confronto numerico CP vs RPP a fatica.
  const required_wkg = cpWkg;
  const athleteFresh = nearestRppWkg(profile, demand.est_duration_s ?? 1200);
  const athlete_wkg =
    athleteFresh != null ? Number((athleteFresh * factor).toFixed(2)) : null;
  const gap_wkg =
    required_wkg != null && athlete_wkg != null
      ? Number((required_wkg - athlete_wkg).toFixed(2))
      : null;

  const severity: Severity =
    gap_wkg != null ? severityFromGap(gap_wkg, demand.fatigue_level) : "low";

  const isLong = demand.demand_type === "long_sustained";
  const fatigued = demand.fatigue_level === "fatigued";

  const name = isLong
    ? fatigued
      ? "Salita lunga a fatica"
      : "Salita lunga sostenuta"
    : "Sforzo medio sostenuto";

  const training_lever = isLong
    ? fatigued
      ? "durability_fatigued"
      : "threshold_long"
    : "sweet_spot_long";

  const workout_library_refs = isLong
    ? fatigued
      ? ["SS 3×20'", "lungo Z2 con blocchi di qualità a fine seduta"]
      : ["soglia 2×20'"]
    : ["SS 3×15'"];

  const evidence =
    required_wkg != null && athlete_wkg != null && gap_wkg != null
      ? `Richiede ~${required_wkg.toFixed(2)} W/kg · hai ~${athlete_wkg.toFixed(2)} W/kg ${
          demand.fatigue_level !== "fresh" ? "(a fatica) " : ""
        }· gap ${gap_wkg > 0 ? "+" : ""}${gap_wkg.toFixed(2)} W/kg`
      : "Dati CP/RPP insufficienti per il confronto numerico";

  return {
    ...base,
    name,
    required_wkg,
    athlete_wkg,
    gap_wkg,
    severity,
    training_lever,
    workout_library_refs,
    evidence,
  };
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Ordina: rosso → giallo → verde; dentro ogni colore per gap_wkg desc. */
function sortLimiters(limiters: Limiter[]): Limiter[] {
  return [...limiters].sort((a, b) => {
    const bySev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySev !== 0) return bySev;
    const ga = a.gap_wkg ?? -Infinity;
    const gb = b.gap_wkg ?? -Infinity;
    return gb - ga;
  });
}

/** Etichetta generica plurale del gruppo, per chiave training_lever. */
const LEVER_GROUP_LABELS: Record<string, string> = {
  durability_fatigued: "Salite lunghe a fatica",
  threshold_long: "Salite lunghe sostenute",
  sweet_spot_long: "Sforzi medi sostenuti",
  wprime_reconstitution: "Strappi brevi ripetuti",
  neuromuscular: "Pitch ripidi neuromuscolari",
};

/** Media dei valori non-null (null se tutti null), arrotondata a 2 decimali. */
function avgOrNull(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return Number((nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(2));
}

/**
 * Raggruppa i limitatori simili per (training_lever + severity). Un gruppo con
 * ≥2 salite diventa un singolo limitatore aggregato (nome generico ×N, km
 * elencati, valori W/kg medi); i gruppi con 1 sola salita restano invariati.
 * L'ordine finale resta rosso → giallo → verde, per gap medio decrescente.
 */
export function groupLimiters(limiters: Limiter[]): Limiter[] {
  // Raggruppamento stabile per chiave, preservando l'ordine di comparsa.
  const groups = new Map<string, Limiter[]>();
  for (const limiter of limiters) {
    const key = `${limiter.training_lever}__${limiter.severity}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(limiter);
    else groups.set(key, [limiter]);
  }

  const result: Limiter[] = [];
  for (const bucket of Array.from(groups.values())) {
    if (bucket.length === 1) {
      result.push(bucket[0]);
      continue;
    }

    const first = bucket[0];
    const climb_refs = bucket
      .flatMap((l) => l.climb_refs)
      .sort((a, b) => a - b);
    const required_wkg = avgOrNull(bucket.map((l) => l.required_wkg));
    const athlete_wkg = avgOrNull(bucket.map((l) => l.athlete_wkg));
    const gap_wkg = avgOrNull(bucket.map((l) => l.gap_wkg));

    const groupLabel = LEVER_GROUP_LABELS[first.training_lever] ?? first.name;
    const minKm = climb_refs[0];
    const maxKm = climb_refs[climb_refs.length - 1];
    const evidence =
      gap_wkg != null
        ? `${bucket.length} salite tra km ${minKm} e km ${maxKm} · gap medio ${
            gap_wkg > 0 ? "+" : ""
          }${gap_wkg.toFixed(2)} W/kg`
        : `${bucket.length} salite tra km ${minKm} e km ${maxKm}`;

    result.push({
      name: `${groupLabel} (×${bucket.length})`,
      climb_ref: first.climb_ref,
      climb_refs,
      demand_type: first.demand_type,
      fatigue_level: first.fatigue_level,
      required_wkg,
      athlete_wkg,
      gap_wkg,
      severity: first.severity, // uguale per tutto il gruppo (parte della chiave)
      training_lever: first.training_lever,
      workout_library_refs: first.workout_library_refs,
      evidence,
      est_duration_s: first.est_duration_s,
    });
  }

  return sortLimiters(result);
}

/**
 * Gap analysis completa: per ogni salita stima durata, domanda e fatica, poi
 * costruisce i limitatori ordinati per severità. Usa solo profile_data + CTL.
 */
export function computeGapAnalysis(
  terrain: TerrainSummary,
  profile: AthleteProfileData,
  ctlToday: number | null
): GapAnalysisResult {
  const cpW = profile.cp_wprime?.cp_w ?? null;
  const weightKg = profile.weight_kg;

  const climb_demands: ClimbDemand[] = terrain.climbs.map((climb) => {
    const est_duration_s = estimateClimbDuration(climb, cpW, weightKg);
    const { demand_type, has_steep_pitch } = classifyDemand(climb, est_duration_s);
    const { fatigue_level, est_kjkg } = estimateFatigue(
      climb,
      terrain.total_distance_km,
      ctlToday
    );
    return {
      climb_ref: climb.position_km,
      est_duration_s,
      demand_type,
      has_steep_pitch,
      fatigue_level,
      est_kjkg,
    };
  });

  const note =
    profile.cp_wprime == null
      ? "CP non disponibile: domanda e fatica sono stimate dalla geometria, manca il confronto numerico in W/kg."
      : weightKg == null
        ? "Peso non disponibile: le durate stimate possono essere imprecise."
        : null;

  // Costruisce un limitatore per salita, poi raggruppa i simili (groupLimiters
  // ordina già per severità/gap), così l'UI non ripete N volte lo stesso.
  const perClimb = terrain.climbs.map((climb, i) =>
    buildLimiter(climb, climb_demands[i], profile)
  );
  const limiters = groupLimiters(perClimb);

  return { climb_demands, limiters, note };
}
