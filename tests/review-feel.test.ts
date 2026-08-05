import assert from "node:assert/strict";
import { test } from "node:test";

import { reconcileFeelVsData, type FeelAnswers, type FeelReconciliationInput } from "../lib/review/feel";

function feel(overrides: Partial<FeelAnswers> = {}): FeelAnswers {
  return {
    energia: 3,
    sonno: 3,
    dolori: 1,
    stress: 3,
    motivazione: 3,
    sedute_migliori: null,
    sedute_peggiori: null,
    note: null,
    ...overrides,
  };
}

function data(overrides: Partial<FeelReconciliationInput> = {}): FeelReconciliationInput {
  return {
    acwr: null,
    tsb: null,
    hardSessionsPlanned: 0,
    hardSessionsMissed: 0,
    avgEasyAboveCeilingFraction: null,
    maxDecouplingPct: null,
    sleepAvgHoursFromIntervals: null,
    ...overrides,
  };
}

function codes(divs: ReturnType<typeof reconcileFeelVsData>): string[] {
  return divs.map((d) => d.code);
}

test("reconcileFeelVsData: energia alta + ACWR alto è una divergenza", () => {
  const divs = reconcileFeelVsData(feel({ energia: 5 }), data({ acwr: 1.4 }));
  assert.ok(codes(divs).includes("energia_alta_acwr_alto"));
});

test("reconcileFeelVsData: energia alta con ACWR normale non segnala nulla", () => {
  const divs = reconcileFeelVsData(feel({ energia: 5 }), data({ acwr: 1.0 }));
  assert.equal(codes(divs).includes("energia_alta_acwr_alto"), false);
});

test("reconcileFeelVsData: energia bassa ma carico normale suggerisce fattori esterni", () => {
  const divs = reconcileFeelVsData(feel({ energia: 1 }), data({ acwr: 0.9, tsb: -5 }));
  assert.ok(codes(divs).includes("energia_bassa_carico_normale"));
});

test("reconcileFeelVsData: uscite facili sopra soglia > 30% segnalate", () => {
  const divs = reconcileFeelVsData(feel(), data({ avgEasyAboveCeilingFraction: 0.35 }));
  assert.ok(codes(divs).includes("facili_non_facili"));
});

test("reconcileFeelVsData: uscite facili sotto soglia non segnalate", () => {
  const divs = reconcileFeelVsData(feel(), data({ avgEasyAboveCeilingFraction: 0.1 }));
  assert.equal(codes(divs).includes("facili_non_facili"), false);
});

test("reconcileFeelVsData: decoupling alto segnalato", () => {
  const divs = reconcileFeelVsData(feel(), data({ maxDecouplingPct: 8.2 }));
  assert.ok(codes(divs).includes("decoupling_alto"));
});

test("reconcileFeelVsData: sonno percepito basso confermato dai dati reali", () => {
  const divs = reconcileFeelVsData(feel({ sonno: 1 }), data({ sleepAvgHoursFromIntervals: 5.2 }));
  assert.ok(codes(divs).includes("sonno_percepito_basso_confermato"));
});

test("reconcileFeelVsData: sonno percepito buono ma dati reali bassi, smentito", () => {
  const divs = reconcileFeelVsData(feel({ sonno: 5 }), data({ sleepAvgHoursFromIntervals: 5.5 }));
  assert.ok(codes(divs).includes("sonno_percepito_alto_smentito"));
});

test("reconcileFeelVsData: dure saltate segnalate", () => {
  const divs = reconcileFeelVsData(feel(), data({ hardSessionsPlanned: 2, hardSessionsMissed: 1 }));
  assert.ok(codes(divs).includes("dure_saltate"));
});

test("reconcileFeelVsData: nessuna divergenza quando tutto è coerente e i dati mancano", () => {
  const divs = reconcileFeelVsData(feel(), data());
  assert.equal(divs.length, 0);
});
