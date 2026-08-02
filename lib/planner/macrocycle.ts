/**
 * Macrociclo stagionale (Passo 8) — modulo PURO, nessuna AI, nessun I/O.
 *
 * Alloca all'indietro dalla data gara i blocchi base→build→peak→taper.
 * Ancorato alla gara (non a oggi): a parità di data gara, le date di
 * inizio di build/peak/taper non cambiano al passare dei giorni — solo il
 * blocco base si accorcia. `today` arriva SEMPRE come parametro (stessa
 * regola dichiarata in phase-detector.ts): mai `new Date()` qui dentro.
 */

import { PEAK_MAX_DAYS, TAPER_MAX_DAYS, type Phase } from "@/lib/planner/phase-detector";

export type MacroPhase = Extract<Phase, "base" | "build" | "peak" | "taper">;

export interface MacrocycleBlock {
  phase: MacroPhase;
  start: string; // YYYY-MM-DD, inclusivo
  end: string; // YYYY-MM-DD, inclusivo
  days: number; // giorni di calendario del blocco (≥1)
  weeks: number; // Math.max(1, Math.round(days / 7)) — solo per l'etichetta
  focus: string; // una riga in italiano, deterministica
}

export interface Macrocycle {
  status: "ok" | "no_race" | "race_past";
  race_date: string | null; // YYYY-MM-DD, null se assente/non valida
  days_to_race: number | null; // giorni interi da today alla gara (0 = oggi)
  blocks: MacrocycleBlock[]; // [] se status !== "ok"; sempre contigui
  planned_phase: Phase | null; // = blocks[0].phase, null se blocks è vuoto
  reason: string; // riga auditabile in italiano
}

// Durate blocco (§ decisione 1 dello spec di Passo 8):
const TAPER_DAYS = TAPER_MAX_DAYS; // 14 — stesso numero di detectPhase
const PEAK_DAYS = PEAK_MAX_DAYS - TAPER_MAX_DAYS + 1; // 29 — copre daysToEvent 14..42, come detectPhase
const BUILD_DAYS = 56; // 8 settimane (WORKOUT_REFERENCE §4.4)
// ponytail: se servisse tarare, si toccano solo queste tre costanti.

const FOCUS: Record<MacroPhase, string> = {
  base: "Volume aerobico e durabilità: si costruisce il motore.",
  build: "Soglia e VO₂max: il volume diventa potenza specifica.",
  peak: "Lavoro specifico di gara: intensità alta, volume in calo.",
  taper: "Scarico pre-gara: freschezza, opener, nessun carico nuovo.",
};

const PHASE_LABEL: Record<MacroPhase, string> = {
  base: "base",
  build: "build",
  peak: "picco",
  taper: "taper",
};

/** dateIso (YYYY-MM-DD) + offset giorni → YYYY-MM-DD (in UTC, niente drift). */
function addDays(dateIso: string, offset: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

/** Timestamp UTC (ms) di una data pura YYYY-MM-DD, o null se non parsabile. */
function parseIsoDateUTC(iso: string): number | null {
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return Date.UTC(y, m - 1, d);
}

export function computeMacrocycle(
  todayIso: string, // YYYY-MM-DD
  raceDateIso: string | null // YYYY-MM-DD (athlete_profiles.data_obiettivo)
): Macrocycle {
  if (raceDateIso == null || raceDateIso === "") {
    return {
      status: "no_race",
      race_date: null,
      days_to_race: null,
      blocks: [],
      planned_phase: null,
      reason: "Nessuna gara target impostata: nessun macrociclo da calcolare.",
    };
  }

  const raceMs = parseIsoDateUTC(raceDateIso);
  const todayMs = parseIsoDateUTC(todayIso);
  if (raceMs == null || todayMs == null) {
    return {
      status: "no_race",
      race_date: null,
      days_to_race: null,
      blocks: [],
      planned_phase: null,
      reason: "Nessuna gara target impostata: nessun macrociclo da calcolare.",
    };
  }

  const daysToRace = Math.round((raceMs - todayMs) / 86_400_000);

  if (daysToRace < 0) {
    return {
      status: "race_past",
      race_date: raceDateIso,
      days_to_race: daysToRace,
      blocks: [],
      planned_phase: null,
      reason: `Gara del ${raceDateIso} già passata (${-daysToRace} giorni fa): nessun macrociclo da calcolare.`,
    };
  }

  const total = daysToRace + 1; // finestra today..raceDate inclusiva
  const taperDays = Math.min(TAPER_DAYS, total);
  const peakDays = Math.min(PEAK_DAYS, total - taperDays);
  const buildDays = Math.min(BUILD_DAYS, total - taperDays - peakDays);
  const baseDays = total - taperDays - peakDays - buildDays;

  const segments: Array<{ phase: MacroPhase; days: number }> = [
    { phase: "base", days: baseDays },
    { phase: "build", days: buildDays },
    { phase: "peak", days: peakDays },
    { phase: "taper", days: taperDays },
  ];

  const blocks: MacrocycleBlock[] = [];
  let cursor = todayIso;
  for (const seg of segments) {
    if (seg.days <= 0) continue;
    const start = cursor;
    const end = addDays(start, seg.days - 1);
    blocks.push({
      phase: seg.phase,
      start,
      end,
      days: seg.days,
      weeks: Math.max(1, Math.round(seg.days / 7)),
      focus: FOCUS[seg.phase],
    });
    cursor = addDays(end, 1);
  }

  const parts = blocks.map((b, i) => {
    const label = PHASE_LABEL[b.phase];
    if (i === blocks.length - 1) return `${label} dal ${b.start} alla gara`;
    if (i === 0 && b.phase === "base") return `${label} fino al ${b.end}`;
    return `${label} dal ${b.start} al ${b.end}`;
  });

  return {
    status: "ok",
    race_date: raceDateIso,
    days_to_race: daysToRace,
    blocks,
    planned_phase: blocks[0]?.phase ?? null,
    reason: `Gara il ${raceDateIso} (${daysToRace} giorni): ${parts.join(", ")}.`,
  };
}
