import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeWellnessDay } from "../lib/intervals-client";
import {
  hrvProtocolFromPreferences,
  hrvValue,
  latestHrvMeasurement,
} from "../lib/hrv";

test("normalizza rMSSD e SDNN come misure HRV separate", () => {
  const day = normalizeWellnessDay({
    id: "2026-06-11",
    restingHR: 59,
    hrv: null,
    hrvSDNN: 65,
  });

  assert.equal(day.restingHR, 59);
  assert.equal(day.hrv, null);
  assert.equal(day.hrvSDNN, 65);
});

test("mantiene hrv come valore rMSSD quando presente", () => {
  const day = normalizeWellnessDay({
    id: "2026-06-12",
    hrv: 48,
    hrvSDNN: 61,
  });

  assert.equal(day.hrv, 48);
  assert.equal(day.hrvSDNN, 61);
});

test("seleziona il protocollo HRV senza usare fallback tra sistemi", () => {
  const values = { hrv: 48, hrvSDNN: 61 };

  assert.equal(hrvValue(values, "rmssd"), 48);
  assert.equal(hrvValue(values, "sdnn"), 61);
  assert.equal(hrvValue({ hrv: null, hrvSDNN: 61 }, "rmssd"), null);
});

test("trova l'ultima misura disponibile del solo protocollo selezionato", () => {
  const days = [
    { date: "2026-06-10", hrv: 50, hrvSDNN: 60 },
    { date: "2026-06-11", hrv: null, hrvSDNN: 65 },
  ];

  assert.deepEqual(latestHrvMeasurement(days, "rmssd"), {
    value: 50,
    date: "2026-06-10",
  });
  assert.deepEqual(latestHrvMeasurement(days, "sdnn"), {
    value: 65,
    date: "2026-06-11",
  });
});

test("legge la preferenza persistita e usa rMSSD come default", () => {
  assert.equal(hrvProtocolFromPreferences({ hrv_protocol: "sdnn" }), "sdnn");
  assert.equal(hrvProtocolFromPreferences({}), "rmssd");
});
