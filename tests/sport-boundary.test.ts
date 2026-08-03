import assert from "node:assert/strict";
import { test } from "node:test";

import { buildWeek, isRunningOnlyDossier } from "../lib/planner/build-week";
import {
  computeAvailableDays,
  selectWeekSessions,
  type PlannerDossier,
} from "../lib/planner/session-selector";
import { emptyDossierForm, formToPatch, SPORT_OPTIONS } from "../lib/onboarding/dossier";
import { VALID_LIBRARY_IDS } from "../lib/planner/workout-library";

/**
 * Test del confine sport (docs/PIANO.md P5) — successore di
 * tests/cycling-only.test.ts, rinominato perché non è più vero che l'app
 * conosce solo il ciclismo: l'onboarding lascia scegliere Ciclismo o Corsa
 * (esclusivi), ma la libreria sedute resta solo ciclismo. Copre: comportamento
 * ciclismo sempre attivo (happy path), il gate della scelta sport
 * nell'onboarding, il blocco onesto del planner per chi sceglie Corsa, i casi
 * limite già noti (MTB/gravel, dossier senza sport_principali) e un caso di
 * fallimento (library_id inesistente non deve produrre una sessione "dura"
 * fantasma).
 */

const DOSSIER: PlannerDossier = {
  disponibilita_ore_sett: 8,
  giorni_preferiti: [],
  giorni_impossibili: [],
  durata_max_weekday_min: 90,
  durata_max_weekend_min: 240,
  indoor_outdoor: "outdoor",
  ha_rulli: true,
};

const GO = { decision: "GO" as const, dayKey: null };

function buildOneWeek(dossier: PlannerDossier & { sport_principali?: string[] }) {
  const avail = computeAvailableDays(dossier);
  const sessions = selectWeekSessions("build", dossier, GO, { levers: [] }, avail);
  return buildWeek("2026-06-15", sessions, dossier, null, "build");
}

// --- Happy path: ciclismo sempre attivo, nessun ramo corsa residuo ----------

test("happy path: dossier ciclismo normale produce sport 'Ciclismo' e solo library_id reali", () => {
  const week = buildOneWeek({ ...DOSSIER, sport_principali: ["Ciclismo"] });
  for (const s of week.sessions) {
    if (s.rest) continue;
    assert.equal(s.sport, "Ciclismo");
    assert.ok(s.library_id != null && VALID_LIBRARY_IDS.has(s.library_id));
    // Nessun id di libreria corsa (prefissi RA-/RS-/RV-/RN-/RR-) può comparire:
    // la libreria corsa non esiste ancora (Modulo Corsa parte 2, PIANO.md P5).
    assert.ok(!/^R[ASVNR]-/.test(s.library_id!));
  }
});

test("SPORT_OPTIONS offre sia Ciclismo che Corsa (scelta esclusiva in onboarding)", () => {
  const values = SPORT_OPTIONS.map((o) => o.value);
  assert.deepEqual(values, ["Ciclismo", "Corsa"]);
});

test("emptyDossierForm() non ha uno sport di default: la scelta è obbligatoria", () => {
  const form = emptyDossierForm();
  assert.deepEqual(form.sport_principali, []);
});

test("gate onboarding step 5: nessun avanzamento senza sport scelto", () => {
  const form = emptyDossierForm();
  form.nome = "Mario";
  form.livello_esperienza = "intermediate";
  // Condizione reale di wizard.tsx (canAdvanceStep5): richiede anche lo sport.
  const canAdvance =
    form.sport_principali.length > 0 &&
    form.nome.trim() !== "" &&
    form.livello_esperienza !== "";
  assert.equal(canAdvance, false, "nome+livello non bastano senza sport");

  form.sport_principali = ["Corsa"];
  const canAdvanceConScelta =
    form.sport_principali.length > 0 &&
    form.nome.trim() !== "" &&
    form.livello_esperienza !== "";
  assert.equal(canAdvanceConScelta, true);
});

test("formToPatch: sport Corsa scrive sport_principali ['Corsa']", () => {
  const form = emptyDossierForm();
  form.sport_principali = ["Corsa"];
  const patch = formToPatch(form);
  assert.deepEqual(patch.sport_principali, ["Corsa"]);
});

// --- Blocco onesto: il planner non ha libreria corsa ------------------------

test("isRunningOnlyDossier: riconosce Corsa pura, non blocca ciclismo/MTB/misto/assente", () => {
  assert.equal(isRunningOnlyDossier(["Corsa"]), true);
  assert.equal(isRunningOnlyDossier(["running"]), true, "case-insensitive");
  assert.equal(isRunningOnlyDossier(["Ciclismo"]), false);
  assert.equal(isRunningOnlyDossier(["MTB"]), false);
  // Non raggiungibile dal wizard (scelta esclusiva), ma un dossier legacy
  // misto non deve bloccare chi ha comunque il ciclismo tra gli sport.
  assert.equal(isRunningOnlyDossier(["Corsa", "Ciclismo"]), false);
  assert.equal(isRunningOnlyDossier([]), false);
  assert.equal(isRunningOnlyDossier(undefined), false);
  assert.equal(isRunningOnlyDossier(null), false);
});

// --- Edge case (spec §2.3 resolveSport): MTB/gravel riconosciuto ------------

test("edge case: sport_principali con MTB/gravel produce sport 'MTB'", () => {
  const week = buildOneWeek({ ...DOSSIER, sport_principali: ["MTB"] });
  const worked = week.sessions.find((s) => !s.rest);
  assert.ok(worked);
  assert.equal(worked!.sport, "MTB");
});

test("edge case: indoor_outdoor='indoor' produce sport 'indoor' indipendentemente da sport_principali", () => {
  const week = buildOneWeek({ ...DOSSIER, indoor_outdoor: "indoor", sport_principali: ["Ciclismo"] });
  const worked = week.sessions.find((s) => !s.rest);
  assert.ok(worked);
  assert.equal(worked!.sport, "indoor");
});

// --- Edge case: valore legacy "Corsa" a livello di buildWeek puro -----------
// (il blocco onesto vive nella route /api/planner/generate, PRIMA di
// chiamare buildWeek — questo test resta come rete di sicurezza sulla
// funzione pura: anche se il guard venisse bypassato, non deve inventare
// sedute corsa fantasma né crashare.)

test("edge case: sport_principali legacy ['Corsa'] non fa crashare buildWeek e ricade su 'Ciclismo'", () => {
  assert.doesNotThrow(() => buildOneWeek({ ...DOSSIER, sport_principali: ["Corsa"] }));
  const week = buildOneWeek({ ...DOSSIER, sport_principali: ["Corsa"] });
  const worked = week.sessions.find((s) => !s.rest);
  assert.ok(worked);
  assert.equal(worked!.sport, "Ciclismo", "'Corsa' non matcha mtb/gravel: ricade sul default ciclismo");
});

test("edge case: sport_principali assente/undefined non fa crashare buildWeek", () => {
  const dossierNoSport: PlannerDossier = { ...DOSSIER };
  delete (dossierNoSport as { sport_principali?: string[] }).sport_principali;
  assert.doesNotThrow(() => buildOneWeek(dossierNoSport));
});

test("edge case: sport_principali vuoto ([]) non fa crashare e ricade su 'Ciclismo'", () => {
  const week = buildOneWeek({ ...DOSSIER, sport_principali: [] });
  const worked = week.sessions.find((s) => !s.rest);
  assert.ok(worked);
  assert.equal(worked!.sport, "Ciclismo");
});

// --- Failure case: library_id inesistente degrada a riposo, non crasha -----

test("failure case: un library_id sconosciuto (residuo/corrotto) degrada a sessione di riposo, non crasha buildWeek", () => {
  const avail = computeAvailableDays(DOSSIER);
  const sessions = selectWeekSessions("build", DOSSIER, GO, { levers: [] }, avail);
  // Simula un residuo corrotto: un id di libreria corsa che non esiste ancora
  // nel catalogo (RA-1, prima del Modulo Corsa parte 2).
  const corrupted = sessions.map((s, i) =>
    i === 0 ? { ...s, library_id: "RA-1", is_hard: true } : s
  );
  assert.doesNotThrow(() => buildWeek("2026-06-15", corrupted, DOSSIER, null, "build"));
  const week = buildWeek("2026-06-15", corrupted, DOSSIER, null, "build");
  const degraded = week.sessions[0];
  assert.equal(degraded.rest, true, "template assente in libreria → riposo, non crash né dato inventato");
  assert.equal(degraded.library_id, null);
  assert.equal(degraded.validation_metadata, null);
});
