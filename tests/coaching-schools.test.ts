import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COACHING_SCHOOLS,
  DISAGREEMENTS,
  disagreementsAmong,
  getSchool,
  prevailingAxis,
  resolveSchools,
  suggestSchools,
  traitsFromAnswers,
} from "../lib/coaching/schools";
import { emptyDossierForm, formToPatch } from "../lib/onboarding/dossier";

const AXES = new Set(["polarized", "pyramidal", "threshold"]);

test("libreria: id unici", () => {
  const ids = COACHING_SCHOOLS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("libreria: ogni scuola ha asse valido, metodo non vuoto e almeno 2 fonti", () => {
  for (const s of COACHING_SCHOOLS) {
    assert.ok(AXES.has(s.asse_intensita), `${s.id}: asse fuori allowlist`);
    assert.ok(s.metodo.trim().length > 0, `${s.id}: metodo vuoto`);
    assert.ok(s.fonti.length >= 2, `${s.id}: meno di 2 fonti`);
    for (const f of s.fonti) {
      assert.ok(f.startsWith("https://"), `${s.id}: fonte non è un URL https`);
    }
    assert.ok(s.tratti.length > 0, `${s.id}: nessun tratto`);
  }
});

test("DISAGREEMENTS: ogni coppia esiste davvero in libreria ed è distinta", () => {
  const ids = new Set(COACHING_SCHOOLS.map((s) => s.id));
  for (const d of DISAGREEMENTS) {
    assert.ok(ids.has(d.tra[0]), `${d.tra[0]} non è una scuola`);
    assert.ok(ids.has(d.tra[1]), `${d.tra[1]} non è una scuola`);
    assert.notEqual(d.tra[0], d.tra[1]);
    assert.ok(d.punto.trim().length > 0);
  }
});

test("disagreementsAmong: coppia in contrasto -> il punto vero, non generico", () => {
  const found = disagreementsAmong(["seiler", "coggan_overton"]);
  assert.equal(found.length, 1);
  assert.match(found[0].punto, /sweet spot|zona centrale/i);
});

test("disagreementsAmong: gruppo concorde -> nessun litigio forzato", () => {
  // seiler e san_millan sono entrambe polarized: nessun disaccordo registrato
  // tra loro, ed è corretto restare a lista vuota invece di inventarne uno.
  assert.deepEqual(disagreementsAmong(["seiler", "san_millan"]), []);
  assert.deepEqual(disagreementsAmong(["seiler"]), []); // una sola scuola: niente da confrontare
  assert.deepEqual(disagreementsAmong([]), []);
});

test("getSchool / resolveSchools: id ignoti scartati senza rompere", () => {
  assert.equal(getSchool("seiler")?.asse_intensita, "polarized");
  assert.equal(getSchool("coach_inventato"), null);

  const resolved = resolveSchools(["canova", "coach_inventato", "seiler"]);
  assert.deepEqual(
    resolved.map((s) => s.id),
    ["seiler", "canova"] // ordine della libreria, non dell'input
  );
});

test("prevailingAxis: maggioranza vince", () => {
  assert.equal(prevailingAxis(["seiler", "san_millan", "canova"]), "polarized");
  assert.equal(prevailingAxis(["coggan_overton", "canova", "seiler"]), "threshold");
});

test("prevailingAxis: pareggio o nessuna scuola -> mixed (planner invariato)", () => {
  assert.equal(prevailingAxis(["seiler", "canova"]), "mixed");
  assert.equal(prevailingAxis([]), "mixed");
  assert.equal(prevailingAxis(["coach_inventato"]), "mixed");
});

test("suggestSchools: lo stile dichiarato pesa più di un singolo tratto", () => {
  const suggested = suggestSchools("polarized", ["struttura"], 2);
  // seiler e san_millan sono gli unici "polarized": +2 ciascuno batte il +1
  // di struttura preso da friel/daniels/hansons.
  assert.deepEqual(
    suggested.map((s) => s.id),
    ["seiler", "san_millan"]
  );
});

test("suggestSchools: senza stile decidono i tratti dell'intervista", () => {
  const suggested = suggestSchools(null, ["sensazioni", "flessibilita"], 1);
  assert.equal(suggested[0].id, "lydiard"); // unica con entrambi i tratti
});

test("traitsFromAnswers: crollo dopo i blocchi e evitarli chiedono la stessa cosa", () => {
  assert.deepEqual(traitsFromAnswers({ blocchi_duri: "reggo_poi_crollo" }), ["recupero"]);
  assert.deepEqual(traitsFromAnswers({ blocchi_duri: "li_evito" }), ["recupero"]);
  assert.deepEqual(traitsFromAnswers({ blocchi_duri: "mi_caricano" }), ["carico_alto"]);
  assert.deepEqual(traitsFromAnswers({}), []);
  assert.deepEqual(
    traitsFromAnswers({ dati_sensazioni: "misto", struttura: "misto" }),
    [] // "misto" non tira da nessuna parte
  );
});

test("suggestSchools: deterministico e limitato", () => {
  const a = suggestSchools("threshold", ["dati", "carico_alto"]);
  const b = suggestSchools("threshold", ["dati", "carico_alto"]);
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  assert.equal(suggestSchools(null, [], 3).length, 3); // nessuna risposta: 3 comunque
});

// --- Mappatura verso il dossier (lib/onboarding/dossier.ts) ------------------

test("formToPatch: intervista non compilata -> filosofia null, stile invariato", () => {
  const form = emptyDossierForm();
  form.stile_allenamento = "pyramidal";
  const patch = formToPatch(form);

  assert.equal(patch.filosofia_risposte, null);
  assert.equal(patch.stile_allenamento, "pyramidal");
});

test("formToPatch: le scuole scelte sovrascrivono lo stile dichiarato", () => {
  const form = emptyDossierForm();
  form.stile_allenamento = "threshold"; // dichiarato allo step Obiettivi
  form.filosofia.scuole = ["seiler", "san_millan"]; // entrambe polarized
  const patch = formToPatch(form);

  assert.equal(patch.stile_allenamento, "polarized");
  assert.deepEqual(
    (patch.filosofia_risposte as { scuole: string[] }).scuole,
    ["seiler", "san_millan"]
  );
});

test("formToPatch: risposte senza scuole -> lo stile resta quello dichiarato", () => {
  const form = emptyDossierForm();
  form.stile_allenamento = "threshold";
  form.filosofia.tono = "duro";
  form.filosofia.storia = "  volume alto = infortunio  ";
  const patch = formToPatch(form);

  assert.equal(patch.stile_allenamento, "threshold");
  const risposte = patch.filosofia_risposte as { tono: string; storia: string };
  assert.equal(risposte.tono, "duro");
  assert.equal(risposte.storia, "volume alto = infortunio"); // trimmato
});
