import type { Climb, TerrainSummary } from "@/lib/terrain/gpx-parser";

/**
 * Logica pura di mapping climb -> segmento polyline per la mappa Leaflet
 * (Race Planner M3). Estratta da route-map.tsx per essere testabile in
 * node:test senza importare `leaflet` (che richiede `window`, assente in
 * node). Stesso filtro di `climbPaths` in event-analysis.tsx.
 */

export function climbSegmentPoints(
  polyline: TerrainSummary["polyline"],
  climb: Pick<Climb, "position_km" | "distance_km">
): TerrainSummary["polyline"] {
  const start = climb.position_km;
  const end = climb.position_km + climb.distance_km;
  return polyline.filter((point) => point[0] >= start && point[0] <= end);
}

/** Colore polyline per pendenza media (COPIA ESATTA da climbVisual() in event-analysis.tsx). */
export function climbColor(avgGradientPct: number): string {
  if (avgGradientPct < 5) return "#4fa3e0"; // dolce
  if (avgGradientPct < 8) return "#f2b33d"; // impegnativa
  return "#f2553d"; // ripida
}
