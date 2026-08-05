import assert from "node:assert/strict";
import { test } from "node:test";

import { computeDecoupling, computeTimeAboveEasyCeiling } from "../lib/review/drift";

const N = 1300; // sopra la soglia minima di 1200 campioni (20 min a 1Hz)

function constant(value: number, n = N): number[] {
  return Array(n).fill(value);
}

// --- computeDecoupling ---------------------------------------------------------

test("computeDecoupling: nessun drift se il rapporto sforzo/battito è costante", () => {
  const result = computeDecoupling(constant(140), constant(200));
  assert.equal(result.decouplingPct, 0);
  assert.equal(result.sampleCount, N);
});

test("computeDecoupling: positivo se il battito sale a parità di sforzo", () => {
  const heartrate = [...constant(140, 650), ...constant(150, 650)];
  const watts = constant(200, 1300);
  const result = computeDecoupling(heartrate, watts);
  assert.equal(result.decouplingPct, 6.7);
});

test("computeDecoupling: negativo se il battito SCENDE a parità di sforzo (adattamento, non drift)", () => {
  const heartrate = [...constant(150, 650), ...constant(140, 650)];
  const watts = constant(200, 1300);
  const result = computeDecoupling(heartrate, watts);
  assert.ok(result.decouplingPct != null && result.decouplingPct < 0);
});

test("computeDecoupling: null sotto la soglia minima di campioni", () => {
  const result = computeDecoupling(constant(140, 500), constant(200, 500));
  assert.equal(result.decouplingPct, null);
  assert.equal(result.sampleCount, 500);
});

test("computeDecoupling: ignora i campioni null/zero da un lato o dall'altro", () => {
  const heartrate = [...constant(140, 1200), ...Array(200).fill(null)];
  const watts = [...constant(200, 1200), ...Array(200).fill(null)];
  const result = computeDecoupling(heartrate, watts);
  assert.equal(result.sampleCount, 1200);
  assert.equal(result.decouplingPct, 0);
});

// --- computeTimeAboveEasyCeiling ------------------------------------------------

const HR_ZONES = [129, 143, 150, 160, 164, 169, 190];

test("computeTimeAboveEasyCeiling: frazione di tempo sopra il tetto (2° confine)", () => {
  const result = computeTimeAboveEasyCeiling([130, 130, 150, 150], HR_ZONES);
  assert.equal(result.easyCeilingBpm, 143);
  assert.equal(result.aboveEasyCeilingFraction, 0.5);
  assert.equal(result.sampleCount, 4);
});

test("computeTimeAboveEasyCeiling: null se le zone FC non sono disponibili", () => {
  assert.equal(computeTimeAboveEasyCeiling([130, 150], null).aboveEasyCeilingFraction, null);
  assert.equal(computeTimeAboveEasyCeiling([130, 150], [143]).aboveEasyCeilingFraction, null);
});

test("computeTimeAboveEasyCeiling: null se non ci sono campioni validi", () => {
  const result = computeTimeAboveEasyCeiling([null, null, 0], HR_ZONES);
  assert.equal(result.aboveEasyCeilingFraction, null);
  assert.equal(result.easyCeilingBpm, 143);
});

test("computeTimeAboveEasyCeiling: tutta la seduta sotto soglia = 0", () => {
  const result = computeTimeAboveEasyCeiling([120, 125, 130], HR_ZONES);
  assert.equal(result.aboveEasyCeilingFraction, 0);
});
