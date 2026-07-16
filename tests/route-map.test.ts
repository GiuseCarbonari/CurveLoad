import assert from "node:assert/strict";
import { test } from "node:test";

import { climbColor, climbSegmentPoints } from "../lib/terrain/route-map-segments";

/**
 * Test di lib/terrain/route-map-segments.ts (Race Planner M3). Copre solo la
 * logica pura di mapping climb → segmento polyline (filtro su `p[0]`, stesso
 * pattern di `climbPaths` in event-analysis.tsx) e la scelta colore
 * (climbColor, stessa soglia/hex di climbVisual() in event-analysis.tsx). Il
 * rendering Leaflet non si testa qui (YAGNI, coperto a mano dal Tester).
 */

test("climbSegmentPoints: ritorna solo i punti nel range km della salita", () => {
  const polyline: Array<[number, number, number, number]> = [
    [0, 45.0, 9.0, 100],
    [0.5, 45.01, 9.0, 120],
    [1.0, 45.02, 9.0, 150],
    [1.5, 45.03, 9.0, 200],
    [2.0, 45.04, 9.0, 180],
  ];
  const climb = { position_km: 0.5, distance_km: 1.0 }; // range [0.5, 1.5]
  const points = climbSegmentPoints(polyline, climb);
  assert.deepEqual(
    points.map((p) => p[0]),
    [0.5, 1.0, 1.5]
  );
});

test("climbSegmentPoints: range senza punti sufficienti ritorna < 2 punti", () => {
  const polyline: Array<[number, number, number, number]> = [
    [0, 45.0, 9.0, 100],
    [2.0, 45.04, 9.0, 180],
  ];
  const climb = { position_km: 0.5, distance_km: 0.2 }; // nessun punto in [0.5, 0.7]
  const points = climbSegmentPoints(polyline, climb);
  assert.ok(points.length < 2, "il segmento deve essere scartato dal chiamante");
});

test("climbSegmentPoints: percorso senza climbs -> nessun segmento, solo tracciato base", () => {
  const polyline: Array<[number, number, number, number]> = [
    [0, 45.0, 9.0, 100],
    [1.0, 45.02, 9.0, 150],
    [2.0, 45.04, 9.0, 180],
  ];
  const climbs: Array<{ position_km: number; distance_km: number }> = [];
  const segments = climbs.map((climb) => climbSegmentPoints(polyline, climb));
  assert.deepEqual(segments, []);
});

test("climbSegmentPoints: polyline vuota -> nessun punto, niente crash", () => {
  const polyline: Array<[number, number, number, number]> = [];
  const climb = { position_km: 0, distance_km: 1 };
  const points = climbSegmentPoints(polyline, climb);
  assert.deepEqual(points, []);
});

test("climbSegmentPoints: polyline con un solo punto -> al massimo 1 punto (stato degenere, il chiamante scarta)", () => {
  const polyline: Array<[number, number, number, number]> = [[0.2, 45.0, 9.0, 100]];
  const climb = { position_km: 0, distance_km: 1 }; // range [0, 1] include l'unico punto
  const points = climbSegmentPoints(polyline, climb);
  assert.ok(points.length < 2, "un solo punto nel range: il chiamante deve scartare il segmento");
});

test("climbSegmentPoints: climb esattamente su un punto di bordo (position_km == distance_km end) e' incluso (>=/<=)", () => {
  const polyline: Array<[number, number, number, number]> = [
    [0, 45.0, 9.0, 100],
    [1, 45.01, 9.0, 120],
    [2, 45.02, 9.0, 150],
  ];
  const climb = { position_km: 1, distance_km: 0 }; // range degenere [1, 1]
  const points = climbSegmentPoints(polyline, climb);
  assert.deepEqual(points.map((p) => p[0]), [1]);
  // Un solo punto: il chiamante (route-map.tsx) scarta con length < 2.
  assert.ok(points.length < 2);
});

test("climbSegmentPoints: coordinate NaN nella polyline non fanno crashare il filtro (difesa)", () => {
  const polyline: Array<[number, number, number, number]> = [
    [0, NaN, 9.0, 100],
    [0.5, 45.01, NaN, 120],
    [1.0, 45.02, 9.0, 150],
  ];
  const climb = { position_km: 0, distance_km: 1 };
  // Il filtro si basa solo su p[0] (km), quindi NaN in lat/lon non alterano
  // l'appartenenza al range: la difesa su lat/lon finiti e' responsabilita'
  // del chiamante (route-map.tsx filtra prima di passare la polyline qui).
  const points = climbSegmentPoints(polyline, climb);
  assert.equal(points.length, 3);
});

test("climbColor: coerente con climbVisual() di event-analysis.tsx (stesse soglie 5%/8%, stessi hex)", () => {
  // Copia esatta della tabella dichiarata nella spec e in event-analysis.tsx.
  assert.equal(climbColor(0), "#4fa3e0");
  assert.equal(climbColor(4.9), "#4fa3e0");
  assert.equal(climbColor(5), "#f2b33d"); // soglia: < 5 e' dolce, 5 esatto e' gia' impegnativa
  assert.equal(climbColor(7.9), "#f2b33d");
  assert.equal(climbColor(8), "#f2553d"); // soglia: < 8 e' impegnativa, 8 esatto e' gia' ripida
  assert.equal(climbColor(15), "#f2553d");
});

test("climbColor: gestisce gradient negativo (difesa, non dovrebbe crashare)", () => {
  assert.equal(climbColor(-2), "#4fa3e0");
});
