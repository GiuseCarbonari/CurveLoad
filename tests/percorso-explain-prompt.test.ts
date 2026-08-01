import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPercorsoExplainPrompt } from "../lib/ai/percorso-explain-prompt";
import { findUnexpectedNumbers } from "../lib/ai/profile-explain-prompt";
import type { GapAnalysisResult } from "../lib/terrain/gap-analysis";
import type { TerrainSummary } from "../lib/terrain/gpx-parser";
import type { RaceEstimateV2 } from "../lib/terrain/race-estimator-v2";

/**
 * Test del costruttore prompt "Spiega il percorso" (Passo 6) — pura, stesso
 * spartito di tests/profile-explain-prompt.test.ts.
 */

const TERRAIN: TerrainSummary = {
  total_distance_km: 42,
  total_elevation_m: 1100,
  elevation_per_km: 26.2,
  course_character: "hilly",
  climbs: [
    {
      position_km: 12,
      distance_km: 4,
      elevation_m: 350,
      avg_gradient_pct: 8.7,
      max_gradient_pct: 12,
      category: "Cat 2",
      start_coords: { lat: 45, lon: 9 },
      end_coords: { lat: 45.05, lon: 9 },
    },
  ],
  descents: [],
  polyline: [],
};

const ANALYSIS: GapAnalysisResult = {
  climb_demands: [],
  limiters: [
    {
      name: "Salita lunga sostenuta",
      climb_ref: 12,
      climb_refs: [12],
      demand_type: "long_sustained",
      fatigue_level: "moderate",
      required_wkg: 3.73,
      athlete_wkg: 3.5,
      gap_wkg: 0.23,
      severity: "medium",
      training_lever: "threshold_long",
      workout_library_refs: ["soglia 2×20'"],
      evidence: "Richiede ~3.73 W/kg · hai ~3.50 W/kg · gap +0.23 W/kg",
      est_duration_s: 1400,
    },
  ],
  note: null,
};

const EVENT = {
  id: 1,
  name: "Gran Fondo Test",
  start_date_local: "2026-09-15",
  distance_km: 42,
};

test("il prompt contiene solo dati già calcolati e la regola no-invenzione", () => {
  const prompt = buildPercorsoExplainPrompt(TERRAIN, ANALYSIS, EVENT, null);
  assert.ok(prompt.system.includes("Non calcoli e non inventi numeri"));
  assert.ok(prompt.user.includes('"nome": "Gran Fondo Test"'));
  assert.ok(prompt.user.includes('"gap_wkg": 0.23'));
  assert.ok(prompt.allowedNumbers.includes(8.7));
  assert.ok(prompt.allowedNumbers.includes(0.23));
});

test("findUnexpectedNumbers: numeri del percorso e dei limitatori passano", () => {
  const prompt = buildPercorsoExplainPrompt(TERRAIN, ANALYSIS, EVENT, null);
  const text =
    "È un percorso di 42 km con 1100 m di dislivello: la salita al km 12 (8,7% medio, punte al 12%) " +
    "è il punto chiave, dove hai un gap di 0,23 W/kg rispetto a quanto richiesto.";
  assert.deepEqual(findUnexpectedNumbers(text, prompt.allowedNumbers), []);
});

test("findUnexpectedNumbers: una quantità inventata (nutrizione) viene segnalata", () => {
  const prompt = buildPercorsoExplainPrompt(TERRAIN, ANALYSIS, EVENT, null);
  const text = "Porta con te almeno 90 grammi di carboidrati all'ora e 500 ml di acqua ogni 20 minuti.";
  const unexpected = findUnexpectedNumbers(text, prompt.allowedNumbers);
  assert.ok(unexpected.includes("90"));
  assert.ok(unexpected.includes("500"));
});

test("la stima tempi (se presente) entra nell'input e i suoi numeri sono ammessi", () => {
  const raceEstimate = {
    pacing: {
      finish_realistic: "3h 15min",
      finish_range: "3h 05min — 3h 30min",
      warning: null,
      key_splits: [],
      pacing_advice: [
        { label: "inizio", from_km: 0, to_km: 14, target_wkg: 3.2, avg_speed_kmh: 22.5 },
      ],
    },
  } as unknown as RaceEstimateV2;

  const prompt = buildPercorsoExplainPrompt(TERRAIN, ANALYSIS, EVENT, raceEstimate);
  assert.ok(prompt.user.includes("3h 15min"));
  assert.ok(prompt.allowedNumbers.includes(3.2));
  assert.ok(prompt.allowedNumbers.includes(15)); // dai minuti dentro "3h 15min"
});
