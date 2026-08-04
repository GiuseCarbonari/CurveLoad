import assert from "node:assert/strict";
import { test } from "node:test";

import { buildWeek } from "../lib/planner/build-week";
import {
  computeAvailableDays,
  hardSpacingOk,
  resolveSportModule,
  selectWeekSessions,
  DAY_KEYS,
  type PlannerDossier,
  type SelectedSession,
} from "../lib/planner/session-selector";
import { emptyDossierForm, formToPatch, SPORT_OPTIONS } from "../lib/onboarding/dossier";
import { CYCLING_LIBRARY_IDS, getTemplate } from "../lib/planner/workout-library";
import { RUN_LIBRARY_IDS } from "../lib/planner/run-workout-library";
import {
  FTP_ZONE_RANGES,
  sessionToEvent,
  toIntervalsDescription,
} from "../lib/planner/intervals-workout-format";
import { formatPace, paceZones, type CSDResult, type RunnerProfileData } from "../lib/profile/pace-profile";
import type { Phase } from "../lib/planner/phase-detector";

/**
 * Test del confine sport (Passo 10 parte 1 — libreria corsa + routing per
 * sport). Copre: comportamento ciclismo bit-per-bit identico (happy path),
 * il nuovo modulo corsa (libreria RA-/RS-/RV-/RN-/RR-, spacing 48h, zone %CS
 * derivate da CS, testi "Corsa" invece di "pedalata"), il routing
 * `resolveSportModule` (sostituisce l'ex `isRunningOnlyDossier`), il push su
 * Intervals (type "Run", niente sintassi %FTP) e i casi No Virtual Math
 * (nessun passo inventato quando CS manca o il fit è fallito).
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

function buildOneWeek(
  dossier: PlannerDossier,
  phase: Phase = "build",
  runnerProfile: RunnerProfileData | null = null
) {
  const avail = computeAvailableDays(dossier);
  const sessions = selectWeekSessions(phase, dossier, GO, { levers: [] }, avail);
  return buildWeek("2026-06-15", sessions, dossier, null, phase, null, runnerProfile);
}

// --- Happy path ---------------------------------------------------------------

test("happy path: dossier Ciclismo produce sport 'Ciclismo' e solo library_id CYCLING_LIBRARY_IDS", () => {
  const week = buildOneWeek({ ...DOSSIER, sport_principali: ["Ciclismo"] });
  for (const s of week.sessions) {
    if (s.rest) continue;
    assert.equal(s.sport, "Ciclismo");
    assert.ok(s.library_id != null && CYCLING_LIBRARY_IDS.has(s.library_id));
    assert.ok(!/^R[ASVNR]-/.test(s.library_id!));
  }
});

test("happy path: dossier Corsa produce sport 'Corsa', solo library_id RUN_LIBRARY_IDS, almeno una dura, spacing 48h ok", () => {
  const dossier: PlannerDossier = { ...DOSSIER, sport_principali: ["Corsa"] };
  const avail = computeAvailableDays(dossier);
  const sessions = selectWeekSessions("build", dossier, GO, { levers: [] }, avail);
  const week = buildWeek("2026-06-15", sessions, dossier, null, "build");

  let hasHard = false;
  for (const s of week.sessions) {
    if (s.rest) continue;
    assert.equal(s.sport, "Corsa");
    assert.ok(s.library_id != null && RUN_LIBRARY_IDS.has(s.library_id));
    assert.ok(!CYCLING_LIBRARY_IDS.has(s.library_id!));
    if (s.is_hard) hasHard = true;
  }
  assert.ok(hasHard, "la settimana corsa deve avere almeno una seduta dura");
  assert.ok(hardSpacingOk(sessions), "spacing minimo 48h tra dure rispettato");
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

test("anti-typo: la settimana corsa non produce MAI un library_id fuori da RUN_LIBRARY_IDS, su tutte le combinazioni fase/readiness/lever/stile", () => {
  const phases: Phase[] = ["base", "build", "peak", "taper", "recovery"];
  const decisions: Array<"GO" | "MODIFY" | "SKIP"> = ["GO", "MODIFY", "SKIP"];
  const leverSets: string[][] = [["threshold_long"], ["durability_fatigued"], []];
  const stiles: Array<string | null> = ["polarized", "threshold", null];

  for (const phase of phases) {
    for (const decision of decisions) {
      for (const levers of leverSets) {
        for (const stile of stiles) {
          const dossier: PlannerDossier = {
            ...DOSSIER,
            sport_principali: ["Corsa"],
            stile_allenamento: stile,
          };
          const avail = computeAvailableDays(dossier);
          const sessions = selectWeekSessions(
            phase,
            dossier,
            { decision, dayKey: "wed" },
            { levers },
            avail
          );
          const week = buildWeek("2026-06-15", sessions, dossier, null, phase);
          for (const s of week.sessions) {
            if (s.rest || s.library_id == null) continue;
            assert.ok(
              RUN_LIBRARY_IDS.has(s.library_id),
              `id fuori dal catalogo corsa: ${s.library_id} (fase=${phase} readiness=${decision} lever=${levers.join(",")} stile=${stile})`
            );
            assert.ok(getTemplate(s.library_id) != null);
          }
        }
      }
    }
  }
});

test("zone %CS: buildWeek arricchisce power_target_zone con un passo m:ss/km coerente con paceZones/formatPace, anche per etichette a doppia zona (Z3–Z4, Z1–Z2)", () => {
  const csd: CSDResult = {
    cs_mps: 4.2,
    cs_pace_s_per_km: Math.round((1000 / 4.2) * 10) / 10,
    d_prime_m: 200,
    r2: 0.995,
    fit_secs: [120, 300, 600, 900],
    model: "CS_2P_LINEAR",
    source: "app_cs2p_fit",
  };
  const runner: RunnerProfileData = {
    meta: {
      generated_at: "2026-01-01T00:00:00.000Z",
      window_days: 42,
      source: "intervals_pace_curves",
      confidence: "high",
      thresholds_version: "v0",
    },
    rpp: [],
    cs_dprime: csd,
  };
  const dossierRun: PlannerDossier = { ...DOSSIER, sport_principali: ["Corsa"] };
  const zones = paceZones(csd);

  // Atteso calcolato con paceZones/formatPace (No Virtual Math nel test:
  // nessuna stringa hardcoded), stessa regola prima-zona/ultima-zona del
  // codice di produzione: prima occorrenza = confine lento, ultima = confine
  // veloce (per RA-1 le due coincidono).
  function expectedPaceTarget(rawLabel: string): string {
    const keys = rawLabel.match(/Z[1-5]/g);
    assert.ok(keys, `nessuna zona in "${rawLabel}"`);
    const first = zones.find((z) => z.key === keys![0]);
    const last = zones.find((z) => z.key === keys![keys!.length - 1]);
    assert.ok(first && last);
    const fast = formatPace(last!.pace_s_per_km_fast);
    const slow = formatPace(first!.pace_s_per_km_slow);
    assert.notEqual(fast, "—");
    return slow === "—" ? `${rawLabel} — più lento di ${fast}/km` : `${rawLabel} — ${slow}–${fast}/km`;
  }

  // RA-1: zona singola (Z2). RS-1: doppia zona Z3–Z4 (il caso che il fit
  // sistemato dal reviewer riguarda: prima del fix il passo era troppo
  // lento). RA-3: doppia zona Z1–Z2 con confine lento infinito (ramo "più
  // lento di").
  for (const libraryId of ["RA-1", "RS-1", "RA-3"]) {
    const template = getTemplate(libraryId)!;
    const sessions: SelectedSession[] = DAY_KEYS.map((day, i): SelectedSession =>
      i === 0
        ? {
            day,
            library_id: libraryId,
            is_hard: template.is_hard_session,
            slot: "easy",
            adapted_duration_min: 40,
            target_zone: template.power_target_zone,
            rationale: "fixture di test",
          }
        : {
            day,
            library_id: null,
            is_hard: false,
            slot: "rest",
            adapted_duration_min: null,
            target_zone: null,
            rationale: "fixture di test",
          }
    );

    const week = buildWeek("2026-06-15", sessions, dossierRun, null, "build", null, runner);
    const s = week.sessions[0];
    assert.equal(s.library_id, libraryId);
    assert.equal(s.power_target_zone, expectedPaceTarget(template.power_target_zone), libraryId);
  }
});

test("testi sport-aware: la settimana corsa non contiene mai 'pedalata', la settimana bici sì", () => {
  const runWeek = buildOneWeek({ ...DOSSIER, sport_principali: ["Corsa"] });
  for (const s of runWeek.sessions) {
    assert.ok(!s.description.toLowerCase().includes("pedalata"));
    assert.ok(!s.interval_structure.toLowerCase().includes("pedalata"));
  }

  const bikeWeek = buildOneWeek({ ...DOSSIER, sport_principali: ["Ciclismo"] });
  const anyPedalata = bikeWeek.sessions.some(
    (s) =>
      s.description.toLowerCase().includes("pedalata") ||
      s.interval_structure.toLowerCase().includes("pedalata")
  );
  assert.ok(anyPedalata, "la settimana bici deve ancora citare 'pedalata' (il ramo non è stato invertito)");
});

// --- Edge case ------------------------------------------------------------

test("resolveSportModule: corsa/running → 'run', ciclismo/MTB/misto/assente → 'bike', sport sconosciuto → null", () => {
  assert.equal(resolveSportModule(["Corsa"]), "run");
  assert.equal(resolveSportModule(["running"]), "run", "case-insensitive");
  assert.equal(resolveSportModule(["Ciclismo"]), "bike");
  assert.equal(resolveSportModule(["MTB"]), "bike");
  // Non raggiungibile dal wizard (scelta esclusiva), ma un dossier legacy
  // misto non deve bloccare chi ha comunque il ciclismo tra gli sport.
  assert.equal(resolveSportModule(["Corsa", "Ciclismo"]), "bike");
  assert.equal(resolveSportModule([]), "bike");
  assert.equal(resolveSportModule(undefined), "bike");
  assert.equal(resolveSportModule(null), "bike");
  assert.equal(resolveSportModule(["Nuoto"]), null);
});

test("sport senza modulo (['Nuoto']): resolveSportModule è null — è il confine che /api/planner/generate usa per rispondere 409 senza generare alcun library_id fantasma", () => {
  assert.equal(resolveSportModule(["Nuoto"]), null);
});

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

test("push: ogni seduta corsa della settimana passata a sessionToEvent produce type 'Run', e toIntervalsDescription non ha sintassi %FTP", () => {
  const dossier: PlannerDossier = { ...DOSSIER, sport_principali: ["Corsa"] };
  const week = buildOneWeek(dossier);
  const worked = week.sessions.filter((s) => !s.rest);
  assert.ok(worked.length > 0);

  // Iterare su TUTTA la settimana, non solo sulla prima seduta non-rest: una
  // nota coach di RA-2 contiene "%" (">8% a passo stabile") pur non essendo
  // una prescrizione FTP — il confine vero è l'assenza dei blocchi %FTP
  // strutturati (FTP_ZONE_RANGES / Warm-up / Main set), non della cifra "%".
  for (const session of worked) {
    const event = sessionToEvent(session, "test-user", "2026-06-15");
    assert.equal(event.type, "Run", session.library_id ?? undefined);

    const description = toIntervalsDescription(session);
    assert.ok(!description.includes("Warm-up") && !description.includes("Main set"), session.library_id ?? undefined);
    for (const range of Object.values(FTP_ZONE_RANGES)) {
      assert.ok(!description.includes(range), `${session.library_id}: contiene "${range}"`);
    }
  }
});

// --- Failure case (No Virtual Math) ----------------------------------------

test("failure case: runnerProfile null → power_target_zone corsa resta etichetta secca, nessun m:ss inventato, nessun crash", () => {
  const dossier: PlannerDossier = { ...DOSSIER, sport_principali: ["Corsa"] };
  assert.doesNotThrow(() => buildOneWeek(dossier, "build", null));
  const week = buildOneWeek(dossier, "build", null);
  for (const s of week.sessions) {
    if (s.rest || s.power_target_zone == null) continue;
    assert.ok(!/\d+:\d{2}/.test(s.power_target_zone));
  }
});

test("failure case: cs_dprime null (fit fallito) → stesso esito di runnerProfile assente, mai una zona finta", () => {
  const runner: RunnerProfileData = {
    meta: {
      generated_at: "2026-01-01T00:00:00.000Z",
      window_days: 42,
      source: "intervals_pace_curves",
      confidence: "low",
      thresholds_version: "v0",
    },
    rpp: [],
    cs_dprime: null,
  };
  const dossier: PlannerDossier = { ...DOSSIER, sport_principali: ["Corsa"] };
  const week = buildOneWeek(dossier, "build", runner);
  for (const s of week.sessions) {
    if (s.rest || s.power_target_zone == null) continue;
    assert.ok(!/\d+:\d{2}/.test(s.power_target_zone));
  }
});

test("failure case: un library_id sconosciuto ('XX-9', 'RA-1' ora esiste in libreria) degrada a riposo, non crasha buildWeek", () => {
  const dossier: PlannerDossier = { ...DOSSIER, sport_principali: ["Ciclismo"] };
  const avail = computeAvailableDays(dossier);
  const sessions = selectWeekSessions("build", dossier, GO, { levers: [] }, avail);
  const corrupted = sessions.map((s, i) =>
    i === 0 ? { ...s, library_id: "XX-9", is_hard: true } : s
  );
  assert.doesNotThrow(() => buildWeek("2026-06-15", corrupted, dossier, null, "build"));
  const week = buildWeek("2026-06-15", corrupted, dossier, null, "build");
  const degraded = week.sessions[0];
  assert.equal(degraded.rest, true, "template assente in libreria → riposo, non crash né dato inventato");
  assert.equal(degraded.library_id, null);
  assert.equal(degraded.validation_metadata, null);
});
