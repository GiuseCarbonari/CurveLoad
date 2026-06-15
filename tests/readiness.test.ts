import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeReadiness,
  type ReadinessInputDay,
} from "../lib/readiness";

/**
 * Test della priority ladder P0–P3 (PRD §14.5).
 * computeReadiness è pura: questi test fissano il comportamento atteso
 * della decisione per ogni gradino della ladder.
 */

/** Giorno wellness "sano" di default; i test sovrascrivono solo ciò che serve. */
function day(overrides: Partial<ReadinessInputDay> = {}): ReadinessInputDay {
  return {
    date: "2026-06-12",
    ctl: 60,
    atl: 60, // TSB 0, ACWR 1.0
    restingHR: 48,
    hrv: 70,
    sleepSecs: 8 * 3600,
    ...overrides,
  };
}

/** Baseline 7g identica al giorno corrente (nessuna deviazione). */
function history(overrides: Partial<ReadinessInputDay> = {}): ReadinessInputDay[] {
  return Array.from({ length: 7 }, (_, i) =>
    day({ date: `2026-06-0${i + 1}`, ...overrides })
  );
}

test("P3: tutto verde → GO", () => {
  const result = computeReadiness(day(), history());
  assert.equal(result.decision, "GO");
  assert.equal(result.priority, 3);
  assert.equal(result.confidence, "high");
});

test("P0: Recovery Index < 0.6 → SKIP non negoziabile", () => {
  const result = computeReadiness(day(), history(), { recoveryIndex: 0.55 });
  assert.equal(result.decision, "SKIP");
  assert.equal(result.priority, 0);
});

test("P0: alarm tier-1 attivo → SKIP", () => {
  const result = computeReadiness(day(), history(), { tier1AlarmActive: true });
  assert.equal(result.decision, "SKIP");
  assert.equal(result.priority, 0);
});

test("P1 skip: ACWR ≥ 1.5 → SKIP", () => {
  // atl 90 / ctl 58 ≈ 1.55
  const result = computeReadiness(day({ ctl: 58, atl: 90 }), history());
  assert.equal(result.decision, "SKIP");
  assert.equal(result.priority, 1);
});

test("P1 skip: TSB < −30 con HRV ↓ > 10% → SKIP", () => {
  // ctl 60, atl 92 → TSB −32; HRV 60 vs baseline 70 → ↓14%.
  // ACWR 1.53 farebbe già scattare P1: si abbassa atl mantenendo TSB < −30
  // alzando ctl. ctl 100, atl 132 → TSB −32, ACWR 1.32 (sotto 1.5)…
  // ACWR 1.32 ≥ 1.3 scatterebbe comunque P1-modify DOPO il check skip:
  // l'ordine first-match della ladder rende il caso valido per lo skip.
  const result = computeReadiness(
    day({ ctl: 100, atl: 132, hrv: 60 }),
    history()
  );
  assert.equal(result.decision, "SKIP");
  assert.equal(result.priority, 1);
});

test("P1 modify: ACWR ≥ 1.3 → MODIFY", () => {
  // atl 80 / ctl 60 ≈ 1.33, TSB −20 (zona normale, non è lui a decidere)
  const result = computeReadiness(day({ ctl: 60, atl: 80 }), history());
  assert.equal(result.decision, "MODIFY");
  assert.equal(result.priority, 1);
});

test("Regola TSB: −20 da solo NON genera MODIFY/SKIP", () => {
  // TSB −20 ma ACWR sotto 1.3: ctl 100, atl 120 → TSB −20, ACWR 1.2.
  // Un solo segnale ambra (TSB) non basta per P2 → GO.
  const result = computeReadiness(day({ ctl: 100, atl: 120 }), history());
  assert.equal(result.decision, "GO");
  assert.equal(result.priority, 3);
});

test("P2: 2 segnali rossi → SKIP", () => {
  // Sonno 4h (rosso) + RHR +6 bpm (rosso); carico neutro.
  const result = computeReadiness(
    day({ sleepSecs: 4 * 3600, restingHR: 54 }),
    history({ restingHR: 48 })
  );
  assert.equal(result.decision, "SKIP");
  assert.equal(result.priority, 2);
});

test("P2: 2 segnali ambra → MODIFY", () => {
  // Sonno 6h (ambra) + RHR +3 bpm (ambra); carico neutro.
  const result = computeReadiness(
    day({ sleepSecs: 6 * 3600, restingHR: 51 }),
    history({ restingHR: 48 })
  );
  assert.equal(result.decision, "MODIFY");
  assert.equal(result.priority, 2);
});

test("Dati assenti: GO con confidence low e segnali unavailable", () => {
  const result = computeReadiness(null, []);
  assert.equal(result.decision, "GO");
  assert.equal(result.priority, 3);
  assert.equal(result.confidence, "low");
  assert.ok(result.signals.every((s) => s.status === "unavailable"));
});

test("Fallback HRV: senza baseline il segnale HRV è unavailable", () => {
  // Storico senza HRV → niente baseline → segnale non classificabile.
  const result = computeReadiness(day(), history({ hrv: null }));
  const hrvSignal = result.signals.find((s) => s.name === "hrv");
  assert.equal(hrvSignal?.status, "unavailable");
});
