import assert from "node:assert/strict";
import { test } from "node:test";

import { buildWeek } from "../lib/planner/build-week";
import {
  computeAvailableDays,
  selectWeekSessions,
  type PlannerDossier,
} from "../lib/planner/session-selector";
import { emptyDossierForm, formToPatch, SPORT_OPTIONS } from "../lib/onboarding/dossier";
import { VALID_LIBRARY_IDS } from "../lib/planner/workout-library";

/**
 * Test di regressione — CurveLoad solo ciclismo (.pipeline/spec.md).
 *
 * Copre: comportamento ciclismo sempre attivo (happy path), i casi limite
 * nominati dallo spec (sport_principali legacy "Corsa", MTB/gravel, dossier
 * senza sport_principali), e un caso di fallimento (library_id inesistente
 * non deve produrre una sessione "dura" fantasma).
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
    // la libreria corsa è stata rimossa, quindi getTemplate() non li conosce
    // più — se un residuo di codice li referenziasse ancora, il template
    // sarebbe undefined e la sessione degraderebbe a riposo (verificato sotto).
    assert.ok(!/^R[ASVNR]-/.test(s.library_id!));
  }
});

test("happy path: SPORT_OPTIONS contiene solo Ciclismo", () => {
  assert.deepEqual(SPORT_OPTIONS, ["Ciclismo"]);
});

test("happy path: emptyDossierForm() inizializza sport_principali a ['Ciclismo'] di default", () => {
  const form = emptyDossierForm();
  assert.deepEqual(form.sport_principali, ["Ciclismo"]);
});

test("happy path: onboarding può avanzare (formToPatch) senza alcuna scelta sport esplicita", () => {
  const form = emptyDossierForm();
  form.nome = "Mario";
  form.livello_esperienza = "intermediate";
  // Condizione reale di wizard.tsx: canAdvanceStep5 non guarda più sport_principali.
  const canAdvance = form.nome.trim() !== "" && form.livello_esperienza !== "";
  assert.ok(canAdvance);
  const patch = formToPatch(form);
  assert.deepEqual(patch.sport_principali, ["Ciclismo"]);
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

// --- Edge case (spec §7 residuo ipotetico): valore legacy "Corsa" -----------

test("edge case: sport_principali legacy ['Corsa'] non fa crashare il planner e ricade su 'Ciclismo'", () => {
  // Nessun utente runner esiste più nel DB (decisione confermata da Giuseppe),
  // ma il codice non deve dipendere da quell'invariante: un valore vecchio
  // eventualmente rimasto non deve produrre un errore o un ramo diverso.
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
  // Simula un residuo corrotto: un id di libreria corsa che non esiste più
  // nel catalogo (come sarebbe RA-1 dopo la rimozione di run-workout-library).
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
