import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildProfileExplainPrompt,
  findUnexpectedNumbers,
} from "../lib/ai/profile-explain-prompt";
import type { AthleteProfileData } from "../lib/profile/build-profile";

/**
 * Test del costruttore prompt "Spiega il mio profilo" e del check
 * anti-numeri-inventati (entrambi puri — spec scheda_atleta §3).
 */

const PROFILE: AthleteProfileData = {
  meta: {
    generated_at: "2026-07-31T08:00:00Z",
    window_days: 42,
    source: "intervals_power_curves",
    confidence: "high",
  },
  weight_kg: 72.5,
  weight_source: "icu_weight",
  rpp: [
    {
      duration_s: 5,
      actual_secs: 5,
      watts: 941,
      wkg: 12.98,
      exact: true,
      watts_1y: 1010,
      wkg_1y: 13.93,
    },
    {
      duration_s: 300,
      actual_secs: 300,
      watts: 310,
      wkg: 4.28,
      exact: false,
      watts_1y: 330,
      wkg_1y: 4.55,
    },
  ],
  ftp_model_w: 270,
  ftp_source: "estimated",
  cp_wprime: {
    cp_w: 270.4,
    cp_wkg: 3.73,
    w_prime_j: 21400,
    w_prime_kj: 21.4,
    p_max_w: 1050,
    ftp_model_w: 270,
    model: "MORTON_3P",
    source: "test",
  },
  cp_power_law: null,
  apr: { msp: 1050, denominator: "cp", apr: 779.6, apr_ratio: 3.88 },
  phenotype: {
    primary: "puncheur",
    secondary: null,
    confidence: "high",
    basis: ["apr_ratio=3.88"],
    thresholds_version: "v0",
  },
  vo2max_5m: null,
};

test("il prompt contiene solo dati già calcolati e la regola no-invenzione", () => {
  const prompt = buildProfileExplainPrompt(PROFILE);
  assert.ok(prompt.system.includes("Non calcoli e non inventi numeri"));
  assert.ok(prompt.user.includes('"cp_w": 270'));
  assert.ok(prompt.user.includes('"puncheur"'));
  assert.ok(prompt.user.includes('"5s"'));
  // I numeri dell'input sono tutti nell'elenco ammesso.
  assert.ok(prompt.allowedNumbers.includes(72.5));
  assert.ok(prompt.allowedNumbers.includes(21.4));
});

test("findUnexpectedNumbers: numeri dell'input (anche arrotondati o con virgola) passano", () => {
  const prompt = buildProfileExplainPrompt(PROFILE);
  const text =
    "La tua potenza critica è 270 W (3,73 W/kg) con una riserva di 21,4 kJ. " +
    "Sui 5 secondi esprimi 941 W, col potenziale a 1010 W dell'ultimo anno.";
  assert.deepEqual(findUnexpectedNumbers(text, prompt.allowedNumbers), []);
});

test("findUnexpectedNumbers: un numero inventato viene segnalato", () => {
  const prompt = buildProfileExplainPrompt(PROFILE);
  const text = "Potresti guadagnare 25 W di soglia arrivando a 295 W.";
  const unexpected = findUnexpectedNumbers(text, prompt.allowedNumbers);
  assert.ok(unexpected.includes("25"));
  assert.ok(unexpected.includes("295"));
});
