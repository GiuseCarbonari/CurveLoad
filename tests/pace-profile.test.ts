import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRunnerProfile,
  estimateCSD,
  extractPaceProfile,
  formatPace,
  paceZones,
  predictRaceTimes,
  type CSDResult,
  type PaceCurve,
  type PaceCurvesResponse,
  type RPPPoint,
} from "../lib/profile/pace-profile";

/**
 * Fixture sintetica (spec §7): curva generata da CS = 4.00 m/s e
 * D′ = 180 m, così il fit deve ritrovare esattamente i parametri di
 * partenza — v(t) = (4.00·t + 180)/t. 60/1200/1800/3600s sono fuori dalla
 * finestra di fit [120,300,600,900] e servono a provare che non la
 * influenzano.
 */

const SECS = [60, 120, 300, 600, 900, 1200, 1800, 3600];
const VALUES = [7.0, 5.5, 4.6, 4.3, 4.2, 4.05, 3.95, 3.8];

function curve(id: string, overrides: Partial<PaceCurve> = {}): PaceCurve {
  return {
    id,
    label: id,
    days: id === "90d" ? 90 : id === "42d" ? 42 : 365,
    secs: [...SECS],
    values: [...VALUES],
    ...overrides,
  };
}

test("estimateCSD: ritrova CS=4.00 e D'=180 dalla fixture sintetica", () => {
  const rpp = extractPaceProfile(curve("42d"));
  const csd = estimateCSD(rpp);
  assert.ok(csd);
  assert.ok(Math.abs(csd.cs_mps - 4.0) < 0.01, `CS fuori tolleranza: ${csd.cs_mps}`);
  assert.ok(Math.abs(csd.d_prime_m - 180) < 1, `D' fuori tolleranza: ${csd.d_prime_m}`);
  assert.ok(csd.r2 >= 0.999, `r2 troppo basso: ${csd.r2}`);
  assert.deepEqual(csd.fit_secs, [120, 300, 600, 900]);
  assert.equal(csd.model, "CS_2P_LINEAR");
  assert.equal(csd.source, "app_cs2p_fit");
});

test("estimateCSD: stravolgere il punto fuori finestra (3600s) non cambia CS/D'", () => {
  const distorted = curve("42d", {
    values: VALUES.map((v, i) => (SECS[i] === 3600 ? 1.0 : v)),
  });
  const rpp = extractPaceProfile(distorted);
  const csd = estimateCSD(rpp);
  assert.ok(csd);
  assert.ok(Math.abs(csd.cs_mps - 4.0) < 0.01);
  assert.ok(Math.abs(csd.d_prime_m - 180) < 1);
});

test("estimateCSD: meno di 3 punti utilizzabili nella finestra di fit → null", () => {
  const points: RPPPoint[] = [120, 300, 600, 900].map((s, i) => ({
    duration_s: s,
    actual_secs: s,
    speed_mps: i < 2 ? 4.5 : null, // solo 2 punti validi nella finestra
    pace_s_per_km: i < 2 ? 1000 / 4.5 : null,
    distance_m: i < 2 ? 4.5 * s : null,
    exact: true,
  }));
  assert.equal(estimateCSD(points), null);
});

test("estimateCSD: velocità crescente con la durata (non fisiologico) → null", () => {
  const badCurve = curve("42d", {
    secs: [120, 300, 600, 900],
    values: [1.2, 3.0, 6.0, 9.0], // cresce con la durata: nessun runner reale
  });
  const rpp = extractPaceProfile(badCurve, [120, 300, 600, 900]);
  assert.equal(
    estimateCSD(rpp),
    null,
    "slope o intercetta non fisiologici devono dare null, non un numero inventato"
  );
});

test("estimateCSD: CS fuori 1.5-6.5 m/s (es. unità sbagliata, tipo km/h letti come m/s) → null anche se ogni punto singolo è plausibile", () => {
  // Distanze costruite da CS=9 m/s, D'=50 m: ogni velocità di punto (9.06-9.42
  // m/s) rientra nel guard per-punto 0.5-12 m/s, quindi solo il guard finale
  // sul CS aggregato (1.5-6.5 m/s) può fermare questo caso.
  const points: RPPPoint[] = [120, 300, 600, 900].map((s) => {
    const d = 9 * s + 50;
    return {
      duration_s: s,
      actual_secs: s,
      speed_mps: d / s,
      pace_s_per_km: 1000 / (d / s),
      distance_m: d,
      exact: true,
    };
  });
  assert.equal(
    estimateCSD(points),
    null,
    "CS aggregato oltre il limite fisiologico (6.5 m/s) deve dare null, non un numero falso"
  );
});

test("extractPaceProfile: durata esatta → exact true, stesso indice", () => {
  const rpp = extractPaceProfile(curve("42d"));
  const at300 = rpp.find((p) => p.duration_s === 300);
  assert.equal(at300?.exact, true);
  assert.equal(at300?.actual_secs, 300);
  assert.equal(at300?.speed_mps, 4.6);
});

test("extractPaceProfile: durata assente → punto più vicino con exact false", () => {
  const rpp = extractPaceProfile(curve("42d"), [150]);
  assert.equal(rpp[0].exact, false);
  assert.equal(rpp[0].actual_secs, 120); // 120 è più vicino a 150 di 300 (30s vs 150s)
  assert.equal(rpp[0].speed_mps, 5.5);
});

test("extractPaceProfile: curva vuota → tutti i punti null", () => {
  const empty = curve("42d", { secs: [], values: [] });
  const rpp = extractPaceProfile(empty, [300]);
  assert.equal(rpp[0].actual_secs, null);
  assert.equal(rpp[0].speed_mps, null);
  assert.equal(rpp[0].pace_s_per_km, null);
  assert.equal(rpp[0].distance_m, null);
  assert.equal(rpp[0].exact, false);
});

test("guard di plausibilità: velocità 0 e 99 m/s → speed_mps null, il fit le ignora", () => {
  const corrupted = curve("42d", {
    values: VALUES.map((v, i) => {
      if (SECS[i] === 60) return 0; // fuori finestra comunque
      if (SECS[i] === 900) return 99; // dentro la finestra di fit, ma impossibile
      return v;
    }),
  });
  const rpp = extractPaceProfile(corrupted);
  assert.equal(rpp.find((p) => p.duration_s === 60)?.speed_mps, null);
  assert.equal(rpp.find((p) => p.duration_s === 900)?.speed_mps, null);

  // Il fit usa solo i restanti 3 punti nella finestra (120,300,600), che
  // stanno esattamente sulla retta CS=4/D'=180 e quindi la ritrovano intatta.
  const csd = estimateCSD(rpp);
  assert.ok(csd);
  assert.ok(Math.abs(csd.cs_mps - 4.0) < 0.01);
  assert.ok(Math.abs(csd.d_prime_m - 180) < 1);
  assert.deepEqual(csd.fit_secs, [120, 300, 600]);
});

test("extractPaceProfile: pace_s_per_km e distance_m calcolati correttamente", () => {
  const rpp = extractPaceProfile(curve("42d"));
  const at300 = rpp.find((p) => p.duration_s === 300);
  assert.ok(at300);
  assert.ok(
    Math.abs((at300.pace_s_per_km ?? 0) - 217.4) < 0.05,
    `pace_s_per_km inatteso: ${at300.pace_s_per_km}`
  );
  assert.equal(at300.distance_m, 4.6 * 300);
});

test("formatPace: mm:ss con riporto e casi limite", () => {
  assert.equal(formatPace(275), "4:35");
  assert.equal(formatPace(299.7), "5:00"); // riporto: non "4:60"
  assert.equal(formatPace(null), "—");
  assert.equal(formatPace(0), "—");
});

test("buildRunnerProfile: integrazione con 42d+1y", () => {
  // 1y con velocità leggermente più alte: riferimento di potenziale.
  const values1y = [7.1, 5.6, 4.7, 4.4, 4.3, 4.15, 4.05, 3.9];
  const response: PaceCurvesResponse = {
    list: [curve("42d"), curve("1y", { values: values1y })],
  };
  const profile = buildRunnerProfile(response, "2026-08-03T10:00:00.000Z");
  assert.ok(profile);
  assert.equal(profile.meta.generated_at, "2026-08-03T10:00:00.000Z");
  assert.equal(profile.meta.window_days, 42);
  assert.equal(profile.meta.source, "intervals_pace_curves");
  assert.ok(profile.cs_dprime);
  assert.ok(Math.abs(profile.cs_dprime.cs_mps - 4.0) < 0.01);

  const rpp300 = profile.rpp.find((p) => p.duration_s === 300);
  assert.ok(rpp300);
  assert.equal(rpp300.speed_mps_1y, 4.7);
  assert.ok(rpp300.pace_s_per_km_1y != null);
});

test("buildRunnerProfile: lista vuota → null", () => {
  assert.equal(buildRunnerProfile({ list: [] }), null);
});

test("buildRunnerProfile: solo 2 punti utilizzabili nella finestra di fit → profilo restituito con confidence low", () => {
  const sparse = curve("42d", {
    secs: [120, 300, 600, 900],
    values: [5.5, 4.6, 0, 99], // 600 e 900 impossibili, 120 e 300 validi
  });
  const profile = buildRunnerProfile({ list: [sparse] });
  assert.ok(profile);
  assert.equal(profile.cs_dprime, null);
  assert.equal(profile.meta.confidence, "low");
});

test("buildRunnerProfile: generatedAt iniettato è puro, nessun clock interno", () => {
  const profile = buildRunnerProfile(
    { list: [curve("42d")] },
    "2020-01-01T00:00:00.000Z"
  );
  assert.ok(profile);
  assert.equal(profile.meta.generated_at, "2020-01-01T00:00:00.000Z");
});

// --- paceZones -----------------------------------------------------------------

/** Stessa fixture sintetica CS=4.00 m/s, D′=180 m usata sopra. */
function fixtureCSD(): CSDResult {
  const csd = estimateCSD(extractPaceProfile(curve("42d")));
  assert.ok(csd, "fixture CSD non disponibile");
  return csd;
}

test("paceZones: null se csd è null", () => {
  assert.deepEqual(paceZones(null), []);
});

test("paceZones: 5 zone ordinate, senza buchi, pace_fast < pace_slow in ognuna", () => {
  const zones = paceZones(fixtureCSD());
  assert.equal(zones.length, 5);
  assert.deepEqual(zones.map((z) => z.key), ["Z1", "Z2", "Z3", "Z4", "Z5"]);

  for (const zone of zones) {
    assert.ok(
      zone.pace_s_per_km_fast < zone.pace_s_per_km_slow,
      `${zone.key}: passo veloce (${zone.pace_s_per_km_fast}) deve essere < passo lento (${zone.pace_s_per_km_slow})`
    );
  }

  // Senza buchi: il bordo veloce di ogni zona è il bordo lento della successiva,
  // sia in % di CS sia nel passo corrispondente.
  for (let i = 0; i < zones.length - 1; i++) {
    assert.equal(zones[i].pct_cs_max, zones[i + 1].pct_cs_min);
    assert.equal(zones[i].pace_s_per_km_fast, zones[i + 1].pace_s_per_km_slow);
  }
});

test("paceZones: valori attesi calcolati a mano dalla fixture CS=4.00 m/s", () => {
  const zones = paceZones(fixtureCSD());
  const z1 = zones.find((z) => z.key === "Z1")!;
  const z2 = zones.find((z) => z.key === "Z2")!;
  const z5 = zones.find((z) => z.key === "Z5")!;

  // Z1 è aperta verso il basso (0% CS): nessun limite lento, formatPace la
  // renderà "—".
  assert.equal(z1.pace_s_per_km_slow, Infinity);
  // 80% di 4.0 m/s = 3.2 m/s → 1000/3.2 = 312.5 s/km.
  assert.equal(z1.pace_s_per_km_fast, 312.5);
  // 88% di 4.0 m/s = 3.52 m/s → 1000/3.52 = 284.1 s/km (1 decimale).
  assert.equal(z2.pace_s_per_km_fast, 284.1);
  // 115% di 4.0 m/s = 4.6 m/s → 1000/4.6 = 217.4 s/km (1 decimale).
  assert.equal(z5.pace_s_per_km_fast, 217.4);
});

// --- predictRaceTimes ------------------------------------------------------------

test("predictRaceTimes: null se csd è null", () => {
  assert.deepEqual(predictRaceTimes(null), []);
});

test("predictRaceTimes: 5 km con CS/D' noti = valore atteso calcolato a mano", () => {
  // t = (d - D')/CS = (5000 - 180)/4.0 = 1205 s; passo = 1205/5 = 241 s/km.
  const predictions = predictRaceTimes(fixtureCSD());
  const at5k = predictions.find((p) => p.distance_m === 5000);
  assert.ok(at5k);
  assert.equal(at5k.time_s, 1205);
  assert.equal(at5k.pace_s_per_km, 241);
  assert.equal(at5k.label, "5 km");
});

test("predictRaceTimes: in_model_window === false sulla predizione dei 10 km della fixture", () => {
  // t = (10000 - 180)/4.0 = 2455 s, ben oltre i 900s (15 min) della finestra
  // di fit: stima ottimista, fuori dal modello.
  const predictions = predictRaceTimes(fixtureCSD());
  const at10k = predictions.find((p) => p.distance_m === 10000);
  assert.ok(at10k);
  assert.equal(at10k.time_s, 2455);
  assert.equal(at10k.in_model_window, false);
});

test("predictRaceTimes: distanza minore di D' non compare nell'array", () => {
  const csd: CSDResult = {
    cs_mps: 4.0,
    cs_pace_s_per_km: 250,
    d_prime_m: 1200,
    r2: 1,
    fit_secs: [120, 300, 600, 900],
    model: "CS_2P_LINEAR",
    source: "app_cs2p_fit",
  };
  const predictions = predictRaceTimes(csd, [1000, 5000]);
  assert.equal(
    predictions.find((p) => p.distance_m === 1000),
    undefined,
    "1000m < D'=1200m deve essere scartato, non un tempo negativo"
  );
  assert.ok(predictions.find((p) => p.distance_m === 5000));
});
