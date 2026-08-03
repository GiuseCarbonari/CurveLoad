import assert from "node:assert/strict";
import { test } from "node:test";

import type { AthleteContext } from "../lib/ai/context";
import { buildPhilosophyPrompt } from "../lib/ai/philosophy-prompt";
import { findUnexpectedNumbers } from "../lib/ai/profile-explain-prompt";
import type { FilosofiaForm } from "../lib/onboarding/dossier";

const RISPOSTE: FilosofiaForm = {
  scuole: [],
  storia: "Con tre uscite costanti vado meglio che con sei sporadiche",
  blocchi_duri: "reggo_poi_crollo",
  struttura: "struttura",
  dati_sensazioni: "dati",
  tono: "diretto",
  piace: ["salite", "lungo"],
  detesta: ["indoor"],
};

const CONTEXT: AthleteContext = {
  atleta: { nome: "Giuseppe", obiettivi: "CP da 263 a 280 W" },
  condizione: {
    aggiornata_al: "2026-08-01",
    prontezza_oggi: { decisione: "GO", motivi: ["HRV in linea"], fiducia: "high" },
    forma: { ctl: 52, atl: 48 },
    ftp_w: 263,
    peso_kg: 71.5,
    qualita_dati_0_4: 3,
    attivita_ultimi_14g: [],
  },
  decisioni_recenti: [],
  memoria: [],
};

test("scuole scelte dall'atleta: usate quelle, niente suggerimento", () => {
  const prompt = buildPhilosophyPrompt(
    { ...RISPOSTE, scuole: ["canova", "lydiard"] },
    "threshold",
    CONTEXT
  );

  assert.equal(prompt.suggested, false);
  assert.deepEqual(prompt.schools.map((s) => s.id), ["lydiard", "canova"]);
  assert.ok(prompt.user.includes("Renato Canova"));
  assert.ok(prompt.user.includes("Arthur Lydiard"));
});

test("nessuna scuola scelta: le suggerisce il codice, mai il modello", () => {
  const prompt = buildPhilosophyPrompt(RISPOSTE, "polarized", CONTEXT);

  assert.equal(prompt.suggested, true);
  assert.equal(prompt.schools.length, 3);
  // "polarized" + tratti dati/struttura/recupero: le due polarizzate davanti.
  assert.deepEqual(prompt.schools.slice(0, 2).map((s) => s.id), ["seiler", "san_millan"]);
  // Il prompt vieta esplicitamente di citare fonti non passate nell'input.
  assert.ok(prompt.system.includes("Non citare allenatori"));
});

test("intervista e contesto assenti: prompt valido lo stesso", () => {
  const prompt = buildPhilosophyPrompt(null, null, null);

  assert.equal(prompt.suggested, true);
  assert.equal(prompt.schools.length, 3);
  assert.ok(prompt.user.length > 0);
  assert.ok(prompt.system.length > 0);
});

test("allowedNumbers copre i numeri del contesto e quelli dentro le scuole", () => {
  const prompt = buildPhilosophyPrompt(RISPOSTE, "polarized", CONTEXT);

  assert.ok(prompt.allowedNumbers.includes(263), "FTP dal contesto");
  assert.ok(prompt.allowedNumbers.includes(71.5), "peso dal contesto");
  // "80% del tempo" e "4×8" stanno nel metodo di Seiler: sono verificati in
  // docs/COACHING_SCHOOLS.md, quindi citarli non è inventare.
  assert.ok(prompt.allowedNumbers.includes(80));
  assert.ok(prompt.allowedNumbers.includes(8));
});

test("input: dichiarato e osservato separati, il modello può confrontarli", () => {
  const prompt = buildPhilosophyPrompt(RISPOSTE, "polarized", CONTEXT);
  const input = JSON.parse(prompt.user.split("\n").slice(1).join("\n")) as {
    dichiarato: { atleta: unknown };
    osservato: { condizione: unknown };
  };

  assert.deepEqual(input.dichiarato.atleta, CONTEXT.atleta);
  assert.deepEqual(input.osservato.condizione, CONTEXT.condizione);
  // Il system prompt deve dire esplicitamente di confrontarli, non solo
  // separarli: altrimenti il modello può ignorare "osservato" e ripetere
  // solo "dichiarato" (il difetto trovato nella prima verifica).
  assert.ok(prompt.system.includes("CONFRONTALI"));
});

test("scuole in disaccordo vero: il prompt porta il punto e obbliga a schierarsi", () => {
  const prompt = buildPhilosophyPrompt(
    { ...RISPOSTE, scuole: ["seiler", "coggan_overton"] },
    null,
    CONTEXT
  );
  const input = JSON.parse(prompt.user.split("\n").slice(1).join("\n")) as {
    disaccordi: string[];
  };

  assert.equal(input.disaccordi.length, 1);
  assert.match(input.disaccordi[0], /sweet spot|zona centrale/i);
  assert.ok(prompt.system.includes("SCEGLI ESPLICITAMENTE"));
});

test("scuole concordi: nessun disaccordo forzato nell'input", () => {
  const prompt = buildPhilosophyPrompt(
    { ...RISPOSTE, scuole: ["seiler", "san_millan"] },
    null,
    CONTEXT
  );
  const input = JSON.parse(prompt.user.split("\n").slice(1).join("\n")) as {
    disaccordi: string[];
  };
  assert.deepEqual(input.disaccordi, []);
});

test("check anti-invenzione: un numero non derivabile viene segnalato", () => {
  const prompt = buildPhilosophyPrompt(RISPOSTE, "polarized", CONTEXT);

  const buono = "Il tuo FTP è 263 W e il modello che seguiamo è l'80/20.";
  assert.deepEqual(findUnexpectedNumbers(buono, prompt.allowedNumbers), []);

  const inventato = "Punterei a 312 W entro marzo.";
  assert.deepEqual(findUnexpectedNumbers(inventato, prompt.allowedNumbers), ["312"]);
});
