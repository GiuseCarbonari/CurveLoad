import assert from "node:assert/strict";
import { test } from "node:test";

import {
  elevationBounds,
  elevationToY,
  kmToX,
  paginateRows,
} from "../lib/terrain/route-tube-pdf";

/**
 * Test della matematica pura di route-tube-pdf.ts (spec "Scheda telaio PDF").
 * Copre solo normalizzazione quota/progressiva -> mm e paginazione: la
 * generazione jsPDF vera e propria (I/O binario) non si testa qui (YAGNI,
 * verificata a mano dal Tester, vedi spec).
 */

test("elevationBounds: min/range dalla polyline", () => {
  const polyline: Array<[number, number, number, number]> = [
    [0, 45.0, 9.0, 100],
    [1, 45.01, 9.0, 250],
    [2, 45.02, 9.0, 180],
  ];
  const { minElevation, elevationRange } = elevationBounds(polyline);
  assert.equal(minElevation, 100);
  assert.equal(elevationRange, 150);
});

test("elevationBounds: quota costante -> range 1 (evita divisione per zero)", () => {
  const polyline: Array<[number, number, number, number]> = [
    [0, 45.0, 9.0, 500],
    [1, 45.01, 9.0, 500],
  ];
  const { minElevation, elevationRange } = elevationBounds(polyline);
  assert.equal(minElevation, 500);
  assert.equal(elevationRange, 1);
});

test("elevationToY: minElevation sul bordo inferiore del rettangolo", () => {
  const y = elevationToY(100, 100, 150, /* top */ 10, /* height */ 30);
  assert.equal(y, 40); // top + height
});

test("elevationToY: maxElevation sul bordo superiore del rettangolo", () => {
  const y = elevationToY(250, 100, 150, /* top */ 10, /* height */ 30);
  assert.equal(y, 10); // top
});

test("elevationToY: quota a meta' range -> meta' altezza del rettangolo", () => {
  const y = elevationToY(175, 100, 150, /* top */ 10, /* height */ 30);
  assert.equal(y, 25); // top + height/2
});

test("kmToX: km 0 sul bordo sinistro, km massimo sul bordo destro", () => {
  assert.equal(kmToX(0, 40, /* left */ 4, /* width */ 52), 4);
  assert.equal(kmToX(40, 40, 4, 52), 56);
  assert.equal(kmToX(20, 40, 4, 52), 30); // meta' percorso -> meta' larghezza
});

test("kmToX: maxKm 0 (percorso degenere) -> resta sul bordo sinistro, niente crash", () => {
  assert.equal(kmToX(0, 0, 4, 52), 4);
});

test("paginateRows: tutte le righe entrano in una sola pagina", () => {
  const pages = paginateRows(5, 10, 10);
  assert.deepEqual(pages, [5]);
});

test("paginateRows: righe in eccesso vanno su piu' pagine (mai troncate)", () => {
  const pages = paginateRows(25, 10, 10);
  assert.deepEqual(pages, [10, 10, 5]);
  assert.equal(pages.reduce((a, b) => a + b, 0), 25);
});

test("paginateRows: prima pagina con meno spazio (dopo profilo) delle successive", () => {
  const pages = paginateRows(20, 6, 12);
  assert.deepEqual(pages, [6, 12, 2]);
});

test("paginateRows: nessuna riga -> una pagina vuota", () => {
  assert.deepEqual(paginateRows(0, 10, 10), [0]);
});

test("paginateRows: capacita' non positiva non causa loop infinito (almeno 1 riga a pagina)", () => {
  const pages = paginateRows(3, 0, 0);
  assert.deepEqual(pages, [1, 1, 1]);
});
