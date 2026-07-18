import type { TerrainSummary } from "@/lib/terrain/gpx-parser";

/**
 * Matematica pura per la "Scheda telaio (PDF)" (route-tube-pdf-button.tsx):
 * normalizzazione quota/progressiva -> mm nel rettangolo del profilo
 * altimetrico (stessa normalizzazione min/range di PacingChart in
 * race-estimate.tsx, solo che qui mappa in mm invece che nel viewBox SVG) e
 * paginazione della tabella split salite su piu' pagine 60x100mm. Nessuna
 * chiamata jsPDF qui: l'I/O binario del PDF si testa a mano (vedi spec),
 * questo file resta testabile con `assert` puro.
 */

/** Min/range elevazione della polyline — stessa normalizzazione di PacingChart. */
export function elevationBounds(
  polyline: TerrainSummary["polyline"]
): { minElevation: number; elevationRange: number } {
  const elevations = polyline.map((p) => p[3]);
  const minElevation = Math.min(...elevations);
  const elevationRange = Math.max(...elevations) - minElevation || 1;
  return { minElevation, elevationRange };
}

/**
 * Quota (m) -> coordinata Y in mm dentro il rettangolo [top, top+height]:
 * minElevation sul bordo inferiore (top+height), maxElevation sul bordo
 * superiore (top).
 */
export function elevationToY(
  ele: number,
  minElevation: number,
  elevationRange: number,
  top: number,
  height: number
): number {
  return top + height - ((ele - minElevation) / elevationRange) * height;
}

/** Progressiva (km) -> coordinata X in mm dentro il rettangolo [left, left+width]. */
export function kmToX(km: number, maxKm: number, left: number, width: number): number {
  if (maxKm <= 0) return left;
  return left + (km / maxKm) * width;
}

/**
 * Righe per pagina data la capacita' della prima pagina (dopo intestazione +
 * profilo) e delle pagine successive (dopo la sola intestazione colonne,
 * ripetuta in cima a ogni nuova pagina 60x100mm). Nessun troncamento: se le
 * capacita' non bastano, si aggiungono pagine finche' non restano righe.
 * `[0]` se non ci sono righe (nessuna pagina dati, il chiamante gestisce
 * comunque l'intestazione).
 */
export function paginateRows(
  totalRows: number,
  firstPageCapacity: number,
  otherPageCapacity: number
): number[] {
  if (totalRows <= 0) return [0];
  const pages: number[] = [];
  let remaining = totalRows;
  let capacity = Math.max(1, firstPageCapacity);
  while (remaining > 0) {
    const take = Math.min(remaining, capacity);
    pages.push(take);
    remaining -= take;
    capacity = Math.max(1, otherPageCapacity);
  }
  return pages;
}
