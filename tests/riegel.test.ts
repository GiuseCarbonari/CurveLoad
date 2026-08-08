import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRiegelSummary,
  personalKFromRaces,
  predictWithPersonalK,
  standardRiegelPrediction,
  STANDARD_K,
  type RaceResult,
} from "../lib/profile/riegel";

function race(data: string, distanza_km: number, tempo_finale_s: number): RaceResult {
  return { data, distanza_km, tempo_finale_s, livello_preparazione: null };
}

test("standardRiegelPrediction: 5K in 20:00 -> 10K, formula T2=T1*(D2/D1)^1.06", () => {
  const pred = standardRiegelPrediction({ distanceKm: 5, timeSeconds: 1200 }, 10);
  const expected = Math.round(1200 * Math.pow(10 / 5, STANDARD_K));
  assert.equal(pred?.predictedTimeSeconds, expected);
  assert.equal(pred?.exponent, STANDARD_K);
});

test("standardRiegelPrediction: input non validi -> null, mai un numero inventato", () => {
  assert.equal(standardRiegelPrediction({ distanceKm: 0, timeSeconds: 1200 }, 10), null);
  assert.equal(standardRiegelPrediction({ distanceKm: 5, timeSeconds: -1 }, 10), null);
  assert.equal(standardRiegelPrediction({ distanceKm: 5, timeSeconds: 1200 }, 0), null);
});

test("standardRiegelPrediction: target oltre 230 min -> extrapolated true (tetto, non obiettivo)", () => {
  // 5K lento (30:00) proiettato su maratona: ben oltre la finestra 3.5-230min.
  const pred = standardRiegelPrediction({ distanceKm: 5, timeSeconds: 1800 }, 42.195);
  assert.ok(pred != null);
  assert.ok(pred!.predictedTimeSeconds > 13800);
  assert.equal(pred!.extrapolated, true);
});

test("standardRiegelPrediction: target vicino -> extrapolated false", () => {
  const pred = standardRiegelPrediction({ distanceKm: 5, timeSeconds: 1200 }, 10);
  assert.equal(pred?.extrapolated, false);
});

test("predictWithPersonalK: k=1 -> scala linearmente con la distanza (caso limite verificabile a mano)", () => {
  const pred = predictWithPersonalK({ distanceKm: 5, timeSeconds: 1000 }, 1, 10);
  assert.equal(pred?.predictedTimeSeconds, 2000);
});

test("personalKFromRaces: ritrova k=1.10 esatto da due gare sintetiche costruite su quel k", () => {
  const kTrue = 1.1;
  const t1 = 1000;
  const t2 = Math.round(t1 * Math.pow(10 / 5, kTrue));
  const result = personalKFromRaces([race("2026-01-01", 5, t1), race("2026-02-01", 10, t2)]);
  assert.ok(result != null);
  assert.ok(Math.abs(result!.k - kTrue) < 0.005);
  assert.equal(result!.pairsUsed, 1);
  assert.equal(result!.kMin, null); // una sola coppia: nessun range da mostrare
  assert.equal(result!.kMax, null);
});

test("personalKFromRaces: meno di 2 gare -> null", () => {
  assert.equal(personalKFromRaces([]), null);
  assert.equal(personalKFromRaces([race("2026-01-01", 5, 1200)]), null);
});

test("personalKFromRaces: distanze troppo vicine (rapporto <1.15x) -> coppia rifiutata, k null", () => {
  const result = personalKFromRaces([race("2026-01-01", 10, 2400), race("2026-01-15", 11, 2640)]);
  assert.equal(result, null);
});

test("personalKFromRaces: k fuori [0.85,1.30] -> coppia rifiutata come out_of_range", () => {
  // Stessa distanza doppia in appena 5 minuti in più: k implausibile (~0.07).
  const result = personalKFromRaces([race("2026-01-01", 5, 1200), race("2026-02-01", 10, 1260)]);
  assert.equal(result, null);
});

test("personalKFromRaces: 3 gare sulla stessa retta k=1.0 -> pairsUsed=3, kMin=kMax=1.0", () => {
  const result = personalKFromRaces([
    race("2026-01-01", 5, 1200),
    race("2026-02-01", 10, 2400),
    race("2026-03-01", 20, 4800),
  ]);
  assert.ok(result != null);
  assert.equal(result!.pairsUsed, 3);
  assert.equal(result!.k, 1);
  assert.equal(result!.kMin, 1);
  assert.equal(result!.kMax, 1);
  assert.equal(result!.rejectedPairs.length, 0);
});

test("buildRiegelSummary: zero gare -> tutto vuoto, nessun numero", () => {
  const summary = buildRiegelSummary([]);
  assert.equal(summary.baseRace, null);
  assert.deepEqual(summary.standard, []);
  assert.equal(summary.personalK, null);
  assert.deepEqual(summary.personal, []);
});

test("buildRiegelSummary: una gara sola -> solo standard, nessun k personale", () => {
  const summary = buildRiegelSummary([race("2026-01-01", 10, 2400)]);
  assert.ok(summary.baseRace != null);
  assert.ok(summary.standard.length > 0);
  assert.equal(summary.personalK, null);
  assert.deepEqual(summary.personal, []);
});

test("buildRiegelSummary: usa la gara più RECENTE come base, non la prima dell'array", () => {
  const summary = buildRiegelSummary([
    race("2026-03-01", 10, 2400),
    race("2026-01-01", 5, 1200),
  ]);
  assert.equal(summary.baseRace?.data, "2026-03-01");
});

test("buildRiegelSummary: due gare valide -> personalK e previsioni personali popolate", () => {
  const summary = buildRiegelSummary([
    race("2026-01-01", 5, 1200),
    race("2026-02-01", 10, 2400),
  ]);
  assert.ok(summary.personalK != null);
  assert.ok(summary.personal.length > 0);
});
