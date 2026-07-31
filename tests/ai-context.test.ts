import assert from "node:assert/strict";
import { test } from "node:test";

import { condenseContext, type ContextSources, type DossierRow } from "../lib/ai/context";
import { buildProfileExplainPrompt } from "../lib/ai/profile-explain-prompt";
import type { MirrorData } from "../lib/intervals/sync";
import type { IntervalsActivity, WellnessDay } from "../lib/intervals-client";
import type { AthleteProfileData } from "../lib/profile/build-profile";

// ---------------------------------------------------------------------------
// Fixture minime
// ---------------------------------------------------------------------------

const emptyDossier: DossierRow = {
  nome: null,
  eta: null,
  sesso: null,
  sport_principali: null,
  livello_esperienza: null,
  obiettivi: null,
  gare_target: null,
  data_obiettivo: null,
  disponibilita_ore_sett: null,
  giorni_preferiti: null,
  giorni_impossibili: null,
  infortuni_attuali: null,
  dolore_attuale: null,
  limiti_principali: null,
  preferenze_allenamento: null,
  stile_allenamento: null,
  note_personali: null,
};

function wellnessDay(date: string, ctl: number | null, atl: number | null): WellnessDay {
  return {
    date,
    ctl,
    atl,
    rampRate: null,
    weight: null,
    restingHR: null,
    hrv: null,
    hrvSDNN: null,
    sleepSecs: null,
    soreness: null,
    fatigue: null,
    mood: null,
  };
}

function activity(
  date: string,
  overrides: Partial<IntervalsActivity> = {}
): IntervalsActivity {
  return {
    id: date,
    name: "Giro",
    type: "Ride",
    start_date_local: `${date}T10:00:00`,
    moving_time: 3600,
    distance: null,
    icu_training_load: 80,
    icu_weighted_avg_watts: null,
    average_heartrate: null,
    perceived_exertion: null,
    ...overrides,
  };
}

function mirror(overrides: Partial<MirrorData> = {}): MirrorData {
  return {
    fetched_at: "2026-07-31T08:00:00.000Z",
    athlete_profile: { name: "Giuse", weight: 70, resting_hr: 48, ftp: 250, zones: null },
    wellness_30d: [wellnessDay("2026-07-30", 60.4, 55.1), wellnessDay("2026-07-31", 61.2, 57.9)],
    activities_90d: [],
    hrv_protocol: "rmssd",
    readiness_today: {
      decision: "GO",
      priority: 0,
      signals: [],
      reasons: ["tutto verde"],
      confidence: "high",
    },
    data_quality_warning: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// condenseContext
// ---------------------------------------------------------------------------

test("condenseContext: tutte le fonti assenti -> fascicolo vuoto ma valido", () => {
  const ctx = condenseContext({
    dossier: null,
    mirror: null,
    dataQualityLevel: null,
    decisions: [],
    memories: [],
  });
  assert.deepEqual(ctx, {
    atleta: null,
    condizione: null,
    decisioni_recenti: [],
    memoria: [],
  });
});

test("condenseContext: dossier ripulito da null, stringhe e array vuoti", () => {
  const ctx = condenseContext({
    dossier: {
      ...emptyDossier,
      nome: "Giuseppe",
      obiettivi: "Granfondo a settembre",
      infortuni_attuali: "  ",
      giorni_preferiti: [],
      disponibilita_ore_sett: 8,
    },
    mirror: null,
    dataQualityLevel: null,
    decisions: [],
    memories: [],
  });
  assert.deepEqual(ctx.atleta, {
    nome: "Giuseppe",
    obiettivi: "Granfondo a settembre",
    disponibilita_ore_sett: 8,
  });
});

test("condenseContext: dossier con soli campi vuoti -> atleta null", () => {
  const ctx = condenseContext({
    dossier: emptyDossier,
    mirror: null,
    dataQualityLevel: null,
    decisions: [],
    memories: [],
  });
  assert.equal(ctx.atleta, null);
});

test("condenseContext: condizione dal mirror — forma dall'ultima riga wellness", () => {
  const ctx = condenseContext({
    dossier: null,
    mirror: mirror(),
    dataQualityLevel: 3,
    decisions: [],
    memories: [],
  });
  assert.ok(ctx.condizione);
  assert.equal(ctx.condizione.aggiornata_al, "2026-07-31");
  assert.deepEqual(ctx.condizione.forma, { ctl: 61.2, atl: 57.9 });
  assert.equal(ctx.condizione.ftp_w, 250);
  assert.equal(ctx.condizione.peso_kg, 70);
  assert.equal(ctx.condizione.qualita_dati_0_4, 3);
  assert.equal(ctx.condizione.prontezza_oggi.decisione, "GO");
  assert.deepEqual(ctx.condizione.prontezza_oggi.motivi, ["tutto verde"]);
});

test("condenseContext: attività filtrate a 14 giorni dal fetched_at, ordinate recenti-prima", () => {
  const ctx = condenseContext({
    dossier: null,
    mirror: mirror({
      activities_90d: [
        activity("2026-07-10"), // 21 giorni prima: fuori finestra
        activity("2026-07-20", { moving_time: 5400, icu_training_load: 120 }),
        activity("2026-07-29", { perceived_exertion: 7 }),
      ],
    }),
    dataQualityLevel: null,
    decisions: [],
    memories: [],
  });
  assert.ok(ctx.condizione);
  assert.deepEqual(
    ctx.condizione.attivita_ultimi_14g.map((a) => a.data),
    ["2026-07-29", "2026-07-20"]
  );
  assert.equal(ctx.condizione.attivita_ultimi_14g[1].durata_min, 90);
  assert.equal(ctx.condizione.attivita_ultimi_14g[1].carico, 120);
  assert.equal(ctx.condizione.attivita_ultimi_14g[0].rpe, 7);
});

test("condenseContext: attività cap a 20 anche se la finestra ne contiene di più", () => {
  const many = Array.from({ length: 25 }, (_, i) =>
    activity(`2026-07-${String(20 + (i % 10)).padStart(2, "0")}`, { id: i })
  );
  const ctx = condenseContext({
    dossier: null,
    mirror: mirror({ activities_90d: many }),
    dataQualityLevel: null,
    decisions: [],
    memories: [],
  });
  assert.equal(ctx.condizione?.attivita_ultimi_14g.length, 20);
});

test("condenseContext: decisioni mappate e cap a 10", () => {
  const decisions = Array.from({ length: 12 }, (_, i) => ({
    date: `2026-07-${String(31 - i).padStart(2, "0")}`,
    decision_type: "weekly_plan",
    recommendation: `SED-${i}`,
  }));
  const ctx = condenseContext({
    dossier: null,
    mirror: null,
    dataQualityLevel: null,
    decisions,
    memories: [],
  });
  assert.equal(ctx.decisioni_recenti.length, 10);
  assert.deepEqual(ctx.decisioni_recenti[0], {
    data: "2026-07-31",
    tipo: "weekly_plan",
    decisione: "SED-0",
  });
});

test("condenseContext: memoria mappata (data corta) e cap a 20", () => {
  const memories = Array.from({ length: 25 }, (_, i) => ({
    created_at: `2026-07-${String(31 - (i % 28)).padStart(2, "0")}T10:00:00.000Z`,
    memory_type: "osservazione",
    nota: `Nota ${i}`,
  }));
  const ctx = condenseContext({
    dossier: null,
    mirror: null,
    dataQualityLevel: null,
    decisions: [],
    memories,
  });
  assert.equal(ctx.memoria.length, 20);
  assert.deepEqual(ctx.memoria[0], {
    data: "2026-07-31",
    tipo: "osservazione",
    nota: "Nota 0",
  });
});

// ---------------------------------------------------------------------------
// buildProfileExplainPrompt con contesto
// ---------------------------------------------------------------------------

const profileFixture = {
  phenotype: { primary: "all_rounder", secondary: null, confidence: "medium" },
  apr: null,
  cp_wprime: { cp_w: 240, cp_wkg: 3.4, w_prime_kj: 18.5 },
  rpp: [],
  weight_kg: 70,
  weight_source: "intervals",
} as unknown as AthleteProfileData;

test("buildProfileExplainPrompt: il contesto entra nel messaggio e i suoi numeri sono ammessi", () => {
  const context = condenseContext({
    dossier: { ...emptyDossier, obiettivi: "Granfondo", disponibilita_ore_sett: 9.5 },
    mirror: mirror(),
    dataQualityLevel: 4,
    decisions: [{ date: "2026-07-28", decision_type: "weekly_plan", recommendation: "EN-2" }],
    memories: [
      {
        created_at: "2026-07-30T09:00:00.000Z",
        memory_type: "preferenza",
        nota: "Preferisce le salite lunghe",
      },
    ],
  });
  const prompt = buildProfileExplainPrompt(profileFixture, context);

  assert.ok(prompt.user.includes('"contesto"'));
  assert.ok(prompt.user.includes("Granfondo"));
  // Il taccuino (Passo 5) è nel fascicolo e quindi nel messaggio.
  assert.ok(prompt.user.includes("Preferisce le salite lunghe"));
  // Numeri presenti SOLO nel contesto (ctl 61.2, ore 9.5) devono essere ammessi.
  assert.ok(prompt.allowedNumbers.includes(61.2));
  assert.ok(prompt.allowedNumbers.includes(9.5));
});

test("buildProfileExplainPrompt: senza contesto resta retrocompatibile", () => {
  const prompt = buildProfileExplainPrompt(profileFixture);
  assert.ok(prompt.user.includes('"contesto": null'));
  assert.ok(prompt.allowedNumbers.includes(240));
});
