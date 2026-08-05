import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { buildBriefing } from "../lib/planner/briefing";

/**
 * Test suite per buildBriefing() — righe pre-piano dal validation_metadata
 * e dal mirror. Funzione pura, deterministica, nessuna AI.
 */

describe("buildBriefing", () => {
  test("meta completo → 4 righe nell'ordine atteso", () => {
    const lines = buildBriefing(
      {
        phase_reason: "Fase BUILD: CTL in salita, gara tra 71 giorni.",
        mesocycle_reason: "Settimana 3 di 3 del blocco (§4.2): volume al 108% del target.",
        phase_alignment_reason: null,
      },
      { ctl: 62, atl: 67 },
      "GO",
      71
    );
    assert.equal(lines.length, 4);
    assert.match(lines[0], /CTL 62/);
    assert.match(lines[0], /ACWR 1\.08/);
    assert.match(lines[0], /prontezza GO/);
    assert.equal(lines[1], "Fase BUILD: CTL in salita, gara tra 71 giorni.");
    assert.equal(lines[2], "Settimana 3 di 3 del blocco (§4.2): volume al 108% del target.");
    assert.equal(lines[3], "Gara tra 71 giorni.");
  });

  test("mesocycle_reason assente (piano pre-Passo 8) → niente crash, righe in meno", () => {
    const lines = buildBriefing(
      { phase_reason: "Fase base.", mesocycle_reason: null, phase_alignment_reason: null },
      { ctl: 40, atl: 35 },
      "GO",
      null
    );
    assert.equal(lines.length, 2);
    assert.equal(lines[1], "Fase base.");
  });

  test("wellness_30d vuoto → niente riga di condizione, niente NaN", () => {
    const lines = buildBriefing(
      { phase_reason: "Fase base.", mesocycle_reason: null, phase_alignment_reason: null },
      null,
      null,
      null
    );
    assert.equal(lines.length, 1);
    assert.equal(lines[0], "Fase base.");
    assert.ok(!lines.some((l) => l.includes("NaN")));
  });

  test("ctl = 0 → nessuna divisione per zero nell'ACWR", () => {
    const lines = buildBriefing(null, { ctl: 0, atl: 5 }, "MODIFY", null);
    assert.equal(lines.length, 1);
    assert.doesNotMatch(lines[0], /ACWR/);
    assert.match(lines[0], /prontezza MODIFY/);
  });

  test("meta null e nessun dato → array vuoto, mai una riga inventata", () => {
    const lines = buildBriefing(null, null, null, null);
    assert.deepEqual(lines, []);
  });
});
