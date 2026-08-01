import assert from "node:assert/strict";
import { test } from "node:test";

import { buildOggiExplainPrompt } from "../lib/ai/oggi-explain-prompt";
import { findUnexpectedNumbers } from "../lib/ai/profile-explain-prompt";
import type { ReadinessResult } from "../lib/readiness";

/**
 * Test del costruttore prompt "Spiega la mia giornata" (Passo 6) — pura,
 * stesso spartito di tests/profile-explain-prompt.test.ts.
 */

const READINESS: ReadinessResult = {
  decision: "MODIFY",
  priority: 1,
  confidence: "high",
  reasons: ["P1 sovraccarico: ACWR 1.34 ≥ 1.3"],
  signals: [
    { name: "hrv", value: 62, status: "amber", detail: "HRV rMSSD ↓12% vs baseline 7g" },
    { name: "rhr", value: 48, status: "green", detail: "FC riposo +1 bpm vs baseline 7g" },
    { name: "sleep", value: 6.5, status: "amber", detail: "Sonno 6.5h" },
    { name: "tsb", value: -18.3, status: "amber", detail: "TSB -18.3 (normale in carico)" },
    { name: "acwr", value: 1.34, status: "amber", detail: "ACWR 1.34" },
    { name: "ri", value: 0.78, status: "green", detail: "RI 0.78 (da HRV+RHR)" },
  ],
};

test("il prompt contiene solo dati già calcolati e la regola no-invenzione", () => {
  const prompt = buildOggiExplainPrompt(READINESS);
  assert.ok(prompt.system.includes("Non calcoli e non inventi numeri"));
  assert.ok(prompt.user.includes('"decisione": "MODIFY"'));
  assert.ok(prompt.user.includes("ACWR 1.34"));
  // Numero in un campo strutturato (valore) e uno solo nella prosa (detail).
  assert.ok(prompt.allowedNumbers.includes(1.34));
  assert.ok(prompt.allowedNumbers.includes(12));
});

test("findUnexpectedNumbers: i numeri del testo del motore (anche nella prosa) passano", () => {
  const prompt = buildOggiExplainPrompt(READINESS);
  const text =
    "Oggi conviene alleggerire: l'HRV è sceso del 12% rispetto alla media, con un ACWR a 1,34 " +
    "che segnala un carico un po' alto. Il TSB a -18,3 è normale in questa fase.";
  assert.deepEqual(findUnexpectedNumbers(text, prompt.allowedNumbers), []);
});

test("findUnexpectedNumbers: un numero inventato viene segnalato", () => {
  const prompt = buildOggiExplainPrompt(READINESS);
  const text = "Riduci l'intensità del 30% e punta a 45 minuti facili.";
  const unexpected = findUnexpectedNumbers(text, prompt.allowedNumbers);
  assert.ok(unexpected.includes("30"));
  assert.ok(unexpected.includes("45"));
});

test("il contesto atleta entra nell'input quando presente", () => {
  const prompt = buildOggiExplainPrompt(READINESS, {
    atleta: { obiettivi: "Salire di FTP" },
    condizione: null,
    decisioni_recenti: [],
    memoria: [],
  });
  assert.ok(prompt.user.includes("Salire di FTP"));
});
