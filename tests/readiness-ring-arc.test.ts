import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * Verifica la formula di riempimento dell'anello Readiness
 * (components/dashboard/readiness-ring.tsx): la porzione visibile deve
 * corrispondere esattamente a clamp(value,0,100)/100 della circonferenza.
 */
function scoreOffset(value: number, r = 84): number {
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return C * (1 - pct);
}

const C = 2 * Math.PI * 84;

test("scoreOffset: value 0 -> circonferenza piena (arco vuoto)", () => {
  assert.ok(Math.abs(scoreOffset(0) - C) < 1e-6);
});

test("scoreOffset: value 25 -> C*0.75", () => {
  assert.ok(Math.abs(scoreOffset(25) - C * 0.75) < 1e-6);
});

test("scoreOffset: value 50 -> C*0.5", () => {
  assert.ok(Math.abs(scoreOffset(50) - C * 0.5) < 1e-6);
});

test("scoreOffset: value 69 -> C*0.31", () => {
  assert.ok(Math.abs(scoreOffset(69) - C * 0.31) < 1e-6);
});

test("scoreOffset: value 100 -> 0 (cerchio pieno)", () => {
  assert.ok(Math.abs(scoreOffset(100) - 0) < 1e-6);
});

test("scoreOffset: value -5 -> clamp basso, offset = C", () => {
  assert.ok(Math.abs(scoreOffset(-5) - C) < 1e-6);
});

test("scoreOffset: value 120 -> clamp alto, offset = 0", () => {
  assert.ok(Math.abs(scoreOffset(120) - 0) < 1e-6);
});
