import assert from "node:assert/strict";
import { test } from "node:test";

import type { Climb, TerrainSummary } from "../lib/terrain/gpx-parser";
import {
  SIGNATURE_REF_BIKE_KG,
  SIGNATURE_REF_CRR,
  massFactor,
  surfaceFactor,
} from "../lib/terrain/route-settings";
import { archetypeSignature, type VelocitySignature } from "../lib/terrain/velocity-signature";
import {
  computeRaceEstimateV2,
  estimateRaceTimeV2,
  type RaceEstimateOpts,
} from "../lib/terrain/race-estimator-v2";

/**
 * Test end-to-end del comportamento parametrico (Race Planner M1): verificano
 * che `opts` (bike_weight_kg/cda_m2/repeatability_frac/climb_crr/climb_surface)
 * cambi davvero l'output di estimateRaceTimeV2/computeRaceEstimateV2, colmando
 * il buco lasciato da velocity-signature.test.ts (che non passa mai `opts`).
 */

const CP = 242;
const WEIGHT = 76.2;

/**
 * Firma SENZA bucket: nearestBucket torna sempre null, quindi in salita >3%
 * il modello cade SEMPRE su L3 (fisica pura, dove vivono cda/crr/massa).
 * L'archetipo (usato altrove nel file) ha invece bucket "reliable" a ogni
 * fascia: a 8% il bucket più vicino (7.5% o 10%) intercetta il ramo L1/L2
 * PRIMA della fisica, mascherando l'effetto di cda/crr/bike_weight — per
 * questo i test che isolano la fisica pura usano questa firma vuota.
 */
function noBucketSignature(): VelocitySignature {
  return {
    athlete_id: "u1",
    built_at: "",
    activities_used: 0,
    total_samples: 0,
    buckets: [],
    level: 2,
    coverage_pct: 0,
  };
}

/**
 * Terrain con una salita unica e ripida (>3%, attiva L3/fisica pura in tutto
 * il tratto) seguita da un tratto pianeggiante. 0.5 km di passo come in
 * velocity-signature.test.ts (makeTerrain).
 */
function makeClimbTerrain(): { terrain: TerrainSummary; climb: Climb } {
  const polyline: Array<[number, number, number, number]> = [];
  // 0..10 km pianeggiante (ele costante), 10..20 km salita all'8%, 20..25 km piano in cima.
  const steps = 50; // passo 0.5 km su 25 km
  let ele = 200;
  for (let i = 0; i <= steps; i++) {
    const km = Number((i * 0.5).toFixed(1));
    if (km > 10 && km <= 20) {
      ele += 0.08 * 500; // +8% su 500 m di tratto
    }
    polyline.push([km, 45, 7, Math.round(ele)]);
  }
  const climb: Climb = {
    position_km: 10,
    distance_km: 10,
    elevation_m: Math.round(0.08 * 10000),
    avg_gradient_pct: 8,
    max_gradient_pct: 8,
    category: "Cat 2",
    start_coords: { lat: 45, lon: 7 },
    end_coords: { lat: 45.1, lon: 7.1 },
  };
  const terrain: TerrainSummary = {
    total_distance_km: 25,
    total_elevation_m: climb.elevation_m,
    elevation_per_km: climb.elevation_m / 25,
    course_character: "hilly",
    climbs: [climb],
    descents: [],
    polyline,
  };
  return { terrain, climb };
}

// --- Retrocompatibilità: nessun opts → comportamento storico invariato ------

test("estimateRaceTimeV2 senza opts: identico a se stesso chiamato più volte (nessuna mutazione nascosta)", () => {
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();
  const a = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic");
  const b = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic");
  assert.deepEqual(a, b);
});

test("estimateRaceTimeV2: opts undefined === opts con soli default espliciti", () => {
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();
  const withoutOpts = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic");
  const withDefaultOpts = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", {
    cda_m2: undefined,
    bike_weight_kg: 0,
    repeatability_frac: 1.0,
  });
  assert.deepEqual(withoutOpts, withDefaultOpts);
});

test("computeRaceEstimateV2 senza opts: bike_weight_kg=0, repeatability_frac=1.0, climb_estimates.surface=default", () => {
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();
  const est = computeRaceEstimateV2(terrain, sig, CP, WEIGHT, null);
  assert.equal(est.bike_weight_kg, 0);
  assert.equal(est.repeatability_frac, 1.0);
  assert.equal(est.climb_estimates.length, 1);
  assert.equal(est.climb_estimates[0].surface, "asphalt_rough"); // DEFAULT_SURFACE
});

// --- Margine di ripetibilità -------------------------------------------------

test("repeatability_frac 0.9 rallenta TUTTI e 3 gli scenari rispetto a 1.0", () => {
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();

  const base = computeRaceEstimateV2(terrain, sig, CP, WEIGHT, null, {
    repeatability_frac: 1.0,
  });
  const margined = computeRaceEstimateV2(terrain, sig, CP, WEIGHT, null, {
    repeatability_frac: 0.9,
  });

  assert.ok(
    margined.scenarios.optimistic.total_seconds > base.scenarios.optimistic.total_seconds,
    "optimistic deve essere più lento con margine 0.9"
  );
  assert.ok(
    margined.scenarios.realistic.total_seconds > base.scenarios.realistic.total_seconds,
    "realistic deve essere più lento con margine 0.9"
  );
  assert.ok(
    margined.scenarios.conservative.total_seconds > base.scenarios.conservative.total_seconds,
    "conservative deve essere più lento con margine 0.9"
  );
});

// --- Crr per-salita -----------------------------------------------------------

test("climb_crr più alto SOLO sulla salita: velocità più bassa nel tratto, invariata fuori", () => {
  // Firma senza bucket: forza L3 (fisica pura) in salita, dove climb_crr conta
  // davvero (con l'archetipo il bucket 7.5%/10% intercetterebbe prima l'8%).
  const sig = noBucketSignature();
  const { terrain } = makeClimbTerrain();

  const smoothAsphalt: RaceEstimateOpts = { climb_crr: [0.005] }; // asphalt_smooth
  const looseGravel: RaceEstimateOpts = { climb_crr: [0.016] }; // gravel_loose

  const withAsphalt = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", smoothAsphalt);
  const withGravel = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", looseGravel);

  // Segmenti "in salita": climbIndexAtKm considera km in [position_km, position_km+distance_km] = [10,20].
  const inClimb = (segs: typeof withAsphalt.segments) =>
    segs.filter((s) => s.km >= 10 && s.km <= 20);
  const outsideClimb = (segs: typeof withAsphalt.segments) =>
    segs.filter((s) => s.km < 10 || s.km > 20);

  const climbAsphalt = inClimb(withAsphalt.segments);
  const climbGravel = inClimb(withGravel.segments);
  assert.ok(climbAsphalt.length > 0 && climbGravel.length > 0, "il tratto salita deve avere segmenti");

  // Ogni segmento in salita deve essere più lento (o uguale, mai più veloce) con gravel_loose.
  for (let i = 0; i < climbAsphalt.length; i++) {
    assert.ok(
      climbGravel[i].speed_kmh <= climbAsphalt[i].speed_kmh,
      `segmento km=${climbAsphalt[i].km}: gravel (${climbGravel[i].speed_kmh}) deve essere <= asfalto (${climbAsphalt[i].speed_kmh})`
    );
  }
  // Almeno un segmento strettamente più lento (altrimenti il Crr non ha effetto).
  assert.ok(
    climbGravel.some((s, i) => s.speed_kmh < climbAsphalt[i].speed_kmh),
    "il Crr più alto deve rallentare almeno un segmento in salita"
  );

  // Fuori dalla salita: velocità/gradiente/potenza invariati (climb_crr non si applica
  // lì). NB: cumulative_time_min DEVE differire a valle della salita (la salita più
  // lenta con gravel sposta in avanti tutti i tempi cumulati a valle) — non è un
  // effetto del Crr sul tratto flat, ma della salita più lenta a monte: si confrontano
  // quindi solo i campi "istantanei" del segmento, non il tempo cumulato.
  const outAsphalt = outsideClimb(withAsphalt.segments);
  const outGravel = outsideClimb(withGravel.segments);
  assert.equal(outGravel.length, outAsphalt.length);
  for (let i = 0; i < outAsphalt.length; i++) {
    assert.equal(outGravel[i].km, outAsphalt[i].km);
    assert.equal(outGravel[i].gradient_pct, outAsphalt[i].gradient_pct);
    assert.equal(outGravel[i].power_w, outAsphalt[i].power_w);
    assert.equal(outGravel[i].speed_kmh, outAsphalt[i].speed_kmh);
  }
});

// --- Peso bici -----------------------------------------------------------------

test("bike_weight_kg > 0 rallenta la stima in salita rispetto a bike_weight_kg=0", () => {
  // Firma senza bucket: forza L3 (fisica pura) in salita, dove la massa totale
  // (atleta+bici) entra nel calcolo (con l'archetipo il bucket intercetterebbe prima).
  const sig = noBucketSignature();
  const { terrain } = makeClimbTerrain();

  const noBike = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", { bike_weight_kg: 0 });
  const withBike = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", { bike_weight_kg: 12 });

  const inClimbNoBike = noBike.segments.filter((s) => s.km > 10 && s.km <= 20);
  const inClimbWithBike = withBike.segments.filter((s) => s.km > 10 && s.km <= 20);

  assert.ok(inClimbNoBike.length > 0 && inClimbWithBike.length > 0);
  for (let i = 0; i < inClimbNoBike.length; i++) {
    assert.ok(
      inClimbWithBike[i].speed_kmh <= inClimbNoBike[i].speed_kmh,
      `km=${inClimbNoBike[i].km}: con bici (${inClimbWithBike[i].speed_kmh}) deve essere <= senza bici (${inClimbNoBike[i].speed_kmh})`
    );
  }
  assert.ok(withBike.total_seconds > noBike.total_seconds, "tempo totale più alto con peso bici");
});

// --- climb_estimates: correttezza matematica -----------------------------------

test("climb_estimates: pct_cp/wkg/vam_mh calcolati correttamente, null-guard rispettati", () => {
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();
  const est = computeRaceEstimateV2(terrain, sig, CP, WEIGHT, null);

  assert.equal(est.climb_estimates.length, 1);
  const c = est.climb_estimates[0];

  // pct_cp/wkg derivano dalla media di potenza NON arrotondata dei segmenti nel
  // tratto (avgPowerW), non dal `power_w` già arrotondato per la UI: la si
  // ricalcola qui dai segmenti dello scenario realistico che cadono in salita
  // (stessa fonte usata da buildClimbEstimates), invece di ri-derivarla da un
  // power_w già arrotondato (introdurrebbe un off-by-rounding nel test).
  const topKm = terrain.climbs[0].position_km + terrain.climbs[0].distance_km;
  const inClimb = est.scenarios.realistic.segments.filter(
    (s) => s.km >= terrain.climbs[0].position_km && s.km <= topKm
  );
  const avgPowerW = inClimb.reduce((sum, s) => sum + s.power_w, 0) / inClimb.length;

  const expectedPctCp = Number(((avgPowerW / CP) * 100).toFixed(1));
  assert.equal(c.pct_cp, expectedPctCp);

  const expectedWkg = Number((avgPowerW / WEIGHT).toFixed(2));
  assert.equal(c.wkg, expectedWkg);

  // vam_mh = elevation_m / (time_on_climb_s/3600)
  assert.ok(c.time_on_climb_s > 0, "il tratto salita non deve avere tempo zero in questo fixture");
  const expectedVam = Math.round(c.elevation_m / (c.time_on_climb_s / 3600));
  assert.equal(c.vam_mh, expectedVam);
});

test("climb_estimates: null-guard cp_w<=0 → pct_cp null", () => {
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();
  const est = computeRaceEstimateV2(terrain, sig, 0, WEIGHT, null);
  assert.equal(est.climb_estimates[0].pct_cp, null);
});

test("climb_estimates: null-guard weightKg<=0 → wkg null", () => {
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();
  const est = computeRaceEstimateV2(terrain, sig, CP, 0, null);
  assert.equal(est.climb_estimates[0].wkg, null);
});

test("climb_estimates: salita degenerata (fuori dalla polyline) → time_on_climb_s=0, vam_mh=0, niente NaN/Infinity", () => {
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();
  // Salita "fantasma" oltre la fine del percorso: nessun segmento reale ci cade dentro
  // e avg_speed_kmh resta 0 (nessun segmento -> niente fallback distanza/velocità).
  const ghostClimb: Climb = {
    position_km: 100,
    distance_km: 5,
    elevation_m: 300,
    avg_gradient_pct: 8,
    max_gradient_pct: 8,
    category: "Cat 3",
    start_coords: { lat: 45, lon: 7 },
    end_coords: { lat: 45.1, lon: 7.1 },
  };
  const terrainWithGhost: TerrainSummary = { ...terrain, climbs: [ghostClimb] };
  const est = computeRaceEstimateV2(terrainWithGhost, sig, CP, WEIGHT, null);
  const c = est.climb_estimates[0];
  assert.equal(c.time_on_climb_s, 0);
  assert.equal(c.vam_mh, 0);
  assert.ok(Number.isFinite(c.avg_speed_kmh));
  assert.ok(!Number.isNaN(c.vam_mh));
});

// --- surface nel climb_estimate -------------------------------------------------

test("climb_estimates: surface riflette climb_surface[index] passato in opts", () => {
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();
  const est = computeRaceEstimateV2(terrain, sig, CP, WEIGHT, null, {
    climb_surface: ["gravel_loose"],
  });
  assert.equal(est.climb_estimates[0].surface, "gravel_loose");
});

test("climb_estimates: surface assente in opts.climb_surface → DEFAULT_SURFACE (asphalt_rough)", () => {
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();
  const est = computeRaceEstimateV2(terrain, sig, CP, WEIGHT, null, {
    climb_crr: [0.011], // solo crr passato, niente climb_surface
  });
  assert.equal(est.climb_estimates[0].surface, "asphalt_rough");
});

// --- M1.1: il fondo corregge SEMPRE, anche sul bucket L1/L2 --------------------

test("climb_crr corregge anche il bucket L1/L2 (archetipo): deep_mud più lento di asphalt_smooth (il buco della M1)", () => {
  // Firma archetipo: ha bucket "reliable" su ogni fascia, quindi in salita 8%
  // intercetta L1/L2 PRIMA di L3. Prima di questa iterazione climb_crr non
  // moriva qui: questo test sarebbe FALLITO senza il fix del ramo L1/L2.
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();

  const asphaltSmooth: RaceEstimateOpts = { climb_crr: [0.005] }; // asphalt_smooth
  const deepMud: RaceEstimateOpts = { climb_crr: [0.06] }; // deep_mud (nuova key)

  const withAsphalt = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", asphaltSmooth);
  const withMud = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", deepMud);

  const inClimb = (segs: typeof withAsphalt.segments) =>
    segs.filter((s) => s.km >= 10 && s.km <= 20);
  const outsideClimb = (segs: typeof withAsphalt.segments) =>
    segs.filter((s) => s.km < 10 || s.km > 20);

  const climbAsphalt = inClimb(withAsphalt.segments);
  const climbMud = inClimb(withMud.segments);
  assert.ok(climbAsphalt.length > 0 && climbMud.length > 0, "il tratto salita deve avere segmenti");

  for (let i = 0; i < climbAsphalt.length; i++) {
    assert.ok(
      climbMud[i].speed_kmh <= climbAsphalt[i].speed_kmh,
      `segmento km=${climbAsphalt[i].km}: deep_mud (${climbMud[i].speed_kmh}) deve essere <= asphalt_smooth (${climbAsphalt[i].speed_kmh})`
    );
  }
  assert.ok(
    climbMud.some((s, i) => s.speed_kmh < climbAsphalt[i].speed_kmh),
    "deep_mud deve rallentare almeno un segmento in salita (con l'archetipo, bucket L1/L2)"
  );

  // Fuori salita: velocità istantanea invariata (come nel test L3 esistente).
  const outAsphalt = outsideClimb(withAsphalt.segments);
  const outMud = outsideClimb(withMud.segments);
  assert.equal(outMud.length, outAsphalt.length);
  for (let i = 0; i < outAsphalt.length; i++) {
    assert.equal(outMud[i].speed_kmh, outAsphalt[i].speed_kmh);
  }
});

test("climb_crr = SIGNATURE_REF_CRR (gravel_firm) → nessun cambiamento rispetto a senza climb_crr", () => {
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();

  const withoutCrr = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic");
  const withRefCrr = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", {
    climb_crr: [SIGNATURE_REF_CRR],
  });

  const inClimb = (segs: typeof withoutCrr.segments) =>
    segs.filter((s) => s.km >= 10 && s.km <= 20);

  const climbWithout = inClimb(withoutCrr.segments);
  const climbWithRef = inClimb(withRefCrr.segments);
  assert.equal(climbWithRef.length, climbWithout.length);
  assert.deepEqual(climbWithRef, climbWithout);
});

test("surfaceFactor: direzione della correzione a P costante, clamp e attenuazione col grad", () => {
  assert.equal(surfaceFactor(0.08, 0.011, 0.011), 1);
  assert.ok(surfaceFactor(0.08, 0.011, 0.06) < 1, "fondo peggiore → fattore < 1");
  assert.ok(surfaceFactor(0.08, 0.011, 0.005) > 1, "fondo migliore → fattore > 1");
  assert.equal(surfaceFactor(0.03, 0.011, 0.06), 0.5, "fattore fisico ~0.456 clampato a 0.5");
  assert.ok(
    surfaceFactor(0.15, 0.011, 0.06) > surfaceFactor(0.05, 0.011, 0.06),
    "l'effetto si attenua col grad: più vicino a 1 sul ripido"
  );
});

// --- M1.2: il peso bici corregge SEMPRE, anche sul bucket L1/L2 ---------------

test("bike_weight_kg corregge anche il bucket L1/L2 (archetipo): bici pesante più lenta di bici di riferimento (il buco della M1.1)", () => {
  // Firma archetipo: ha bucket "reliable" su ogni fascia, quindi in salita 8%
  // intercetta L1/L2 PRIMA di L3. Prima di questa iterazione bike_weight_kg non
  // mordeva qui: questo test sarebbe FALLITO senza il fix del ramo L1/L2.
  // Baseline: bike_weight_kg = SIGNATURE_REF_BIKE_KG (13) → massFactor 1.0 esatto.
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();

  const refBike: RaceEstimateOpts = { bike_weight_kg: SIGNATURE_REF_BIKE_KG };
  const heavyBike: RaceEstimateOpts = { bike_weight_kg: 25 };

  const withRefBike = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", refBike);
  const withHeavyBike = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", heavyBike);

  const inClimb = (segs: typeof withRefBike.segments) =>
    segs.filter((s) => s.km >= 10 && s.km <= 20);
  const outsideClimb = (segs: typeof withRefBike.segments) =>
    segs.filter((s) => s.km < 10 || s.km > 20);

  const climbRef = inClimb(withRefBike.segments);
  const climbHeavy = inClimb(withHeavyBike.segments);
  assert.ok(climbRef.length > 0 && climbHeavy.length > 0, "il tratto salita deve avere segmenti");

  for (let i = 0; i < climbRef.length; i++) {
    assert.ok(
      climbHeavy[i].speed_kmh <= climbRef[i].speed_kmh,
      `segmento km=${climbRef[i].km}: bici pesante (${climbHeavy[i].speed_kmh}) deve essere <= bici riferimento (${climbRef[i].speed_kmh})`
    );
  }
  assert.ok(
    climbHeavy.some((s, i) => s.speed_kmh < climbRef[i].speed_kmh),
    "la bici pesante deve rallentare almeno un segmento in salita (con l'archetipo, bucket L1/L2)"
  );

  // Fuori salita: velocità istantanea invariata (come nel test Crr L1/L2 M1.1).
  const outRef = outsideClimb(withRefBike.segments);
  const outHeavy = outsideClimb(withHeavyBike.segments);
  assert.equal(outHeavy.length, outRef.length);
  for (let i = 0; i < outRef.length; i++) {
    assert.equal(outHeavy[i].speed_kmh, outRef[i].speed_kmh);
  }
});

test("bike_weight_kg = SIGNATURE_REF_BIKE_KG (13) → nessun cambiamento rispetto a bike_weight_kg=0 (campo vuoto)", () => {
  const sig = archetypeSignature("u1");
  const { terrain } = makeClimbTerrain();

  const noBike = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", { bike_weight_kg: 0 });
  const refBike = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", {
    bike_weight_kg: SIGNATURE_REF_BIKE_KG,
  });

  const inClimb = (segs: typeof noBike.segments) => segs.filter((s) => s.km >= 10 && s.km <= 20);

  const climbNoBike = inClimb(noBike.segments);
  const climbRefBike = inClimb(refBike.segments);
  assert.equal(climbRefBike.length, climbNoBike.length);
  assert.deepEqual(climbRefBike, climbNoBike);
});

test("massFactor: direzione della correzione a m costante, clamp, e il peso atleta si semplifica (OQ2)", () => {
  assert.equal(massFactor(89, 89), 1, "bici = riferimento → fattore 1.0");
  assert.ok(massFactor(89, 101) < 1, "bici più pesante (massNew > massRef) → fattore < 1");
  assert.ok(massFactor(89, 82) > 1, "bici più leggera (massNew < massRef) → fattore > 1");
  assert.equal(massFactor(70, 200), 0.7, "rapporto 0.35 clampato a 0.7");
  assert.equal(massFactor(200, 70), 1.3, "rapporto ~2.86 clampato a 1.3");

  // Il peso atleta si semplifica: a bici=riferimento, cambiare SOLO il peso
  // atleta lascia il fattore a 1 → nessuna correzione sul peso atleta (OQ2).
  assert.equal(massFactor(76 + 13, 76 + 13), 1);
  assert.equal(massFactor(90 + 13, 90 + 13), 1);
});

test("retro-compat L3: bike_weight_kg su noBucketSignature resta invariato (massFactor non si applica sul ramo L3)", () => {
  // Copertura esplicita del vincolo edge case #4 della spec: sul ramo L3 la
  // differenza deve venire dalla fisica (massTotalKg in physicsVelocity), non
  // da massFactor. Già coperto dal test esistente "bike_weight_kg > 0 rallenta
  // la stima in salita..." (righe sopra, invariato) — qui verifichiamo solo
  // che il comportamento L3 non sia toccato dal nuovo parametro bikeWeightKg.
  const sig = noBucketSignature();
  const { terrain } = makeClimbTerrain();

  const refBike = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", {
    bike_weight_kg: SIGNATURE_REF_BIKE_KG,
  });
  const heavyBike = estimateRaceTimeV2(terrain, sig, CP, WEIGHT, null, "realistic", {
    bike_weight_kg: 25,
  });

  assert.ok(
    heavyBike.total_seconds > refBike.total_seconds,
    "tempo totale più alto con bici più pesante (fisica L3, non massFactor)"
  );
});
