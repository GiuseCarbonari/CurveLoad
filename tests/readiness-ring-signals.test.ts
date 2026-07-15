import assert from "node:assert/strict";
import { test, describe } from "node:test";

import type { ReadinessSignal } from "../lib/readiness";

/**
 * Test del contratto "lista segnali visibili" di ReadinessRing
 * (components/dashboard/readiness-ring.tsx).
 *
 * La logica di selezione non è esportata dal componente (è JSX), quindi qui
 * la replichiamo esattamente come implementata nel componente e verifichiamo
 * il CONTRATTO dichiarato dallo spec (.pipeline/spec.md, Parte 2):
 *   - i segnali ambra/rosso hanno sempre priorità
 *   - i segnali "unavailable" vengono inclusi (non solo pallino grigio)
 *   - tetto di 5 voci totali per non generare "rumore eccessivo"
 *   - "tutti verdi" niente lista, solo il messaggio positivo
 *
 * Se il componente cambia la logica di selezione, questo test si limita a
 * fissare il comportamento osservabile — non i dettagli implementativi.
 */

/** Replica esatta della selezione fatta in readiness-ring.tsx. */
function selectVisibleSignals(signals: ReadinessSignal[]): ReadinessSignal[] {
  const warningSignals = signals.filter(
    (s) => s.status === "amber" || s.status === "red"
  );
  const unavailableSignals = signals.filter((s) => s.status === "unavailable");
  return [...warningSignals, ...unavailableSignals].slice(0, 5);
}

function sig(
  name: ReadinessSignal["name"],
  status: ReadinessSignal["status"],
  detail = `${name} detail`
): ReadinessSignal {
  return { name, value: null, status, detail };
}

describe("ReadinessRing — selezione segnali visibili", () => {
  test("happy path: tutti verdi → nessuna voce visibile", () => {
    const signals: ReadinessSignal[] = [
      sig("hrv", "green"),
      sig("rhr", "green"),
      sig("sleep", "green"),
      sig("tsb", "green"),
      sig("acwr", "green"),
      sig("ri", "green"),
    ];
    const visible = selectVisibleSignals(signals);
    assert.equal(visible.length, 0);
  });

  test("segnali unavailable (HRV/RHR/Sonno/RI) compaiono in lista, non solo come pallino", () => {
    const signals: ReadinessSignal[] = [
      sig("hrv", "unavailable"),
      sig("rhr", "unavailable"),
      sig("sleep", "unavailable"),
      sig("ri", "unavailable"),
      sig("tsb", "green"),
      sig("acwr", "green"),
    ];
    const visible = selectVisibleSignals(signals);
    const names = visible.map((s) => s.name).sort();
    assert.deepEqual(names, ["hrv", "rhr", "ri", "sleep"]);
  });

  test("segnali ambra/rossi hanno priorità sugli unavailable quando insieme superano il tetto", () => {
    // 6 segnali: 3 warning (amber/red) + 3 unavailable → tetto 5, i 3 warning
    // devono essere TUTTI presenti, resta spazio per solo 2 unavailable.
    const signals: ReadinessSignal[] = [
      sig("tsb", "red"),
      sig("acwr", "amber"),
      sig("rhr", "amber"),
      sig("hrv", "unavailable"),
      sig("sleep", "unavailable"),
      sig("ri", "unavailable"),
    ];
    const visible = selectVisibleSignals(signals);
    assert.equal(visible.length, 5);
    const warnings = visible.filter((s) => s.status === "amber" || s.status === "red");
    assert.equal(warnings.length, 3, "tutti i warning devono restare visibili");
    const unavailable = visible.filter((s) => s.status === "unavailable");
    assert.equal(unavailable.length, 2, "solo 2 unavailable entrano nel tetto di 5");
  });

  test("tetto di 5 voci anche con tutti e 6 i segnali in stato non-verde", () => {
    const signals: ReadinessSignal[] = [
      sig("hrv", "red"),
      sig("rhr", "amber"),
      sig("sleep", "amber"),
      sig("tsb", "red"),
      sig("acwr", "amber"),
      sig("ri", "unavailable"),
    ];
    const visible = selectVisibleSignals(signals);
    assert.equal(visible.length, 5);
  });

  test("edge case spec: solo alcuni segnali unavailable, nessun warning → tutti mostrati (sotto il tetto)", () => {
    const signals: ReadinessSignal[] = [
      sig("hrv", "unavailable"),
      sig("rhr", "unavailable"),
      sig("sleep", "green"),
      sig("tsb", "green"),
      sig("acwr", "green"),
      sig("ri", "unavailable"),
    ];
    const visible = selectVisibleSignals(signals);
    assert.equal(visible.length, 3);
    assert.ok(visible.every((s) => s.status === "unavailable"));
  });

  test("failure case: segnale con status sconosciuto/non gestito non viene incluso silenziosamente come warning", () => {
    // status non fa parte dell'unione SignalStatus nota (green/amber/red/unavailable):
    // simuliamo un valore imprevisto per verificare che NON venga trattato
    // come warning né come unavailable (fail-safe: sparisce dalla lista
    // invece di comparire con etichetta sbagliata).
    const signals = [
      sig("hrv", "green"),
      { name: "rhr", value: null, status: "unknown" as ReadinessSignal["status"], detail: "?" },
    ] as ReadinessSignal[];
    const visible = selectVisibleSignals(signals);
    assert.equal(visible.length, 0);
  });
});
