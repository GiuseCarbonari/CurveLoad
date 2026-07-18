"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Climb, TerrainSummary } from "@/lib/terrain/gpx-parser";
import type { RaceEstimateV2 } from "@/lib/terrain/race-estimator-v2";
import { climbColor, climbSegmentPoints } from "@/lib/terrain/route-map-segments";
import { elevationBounds, elevationToY, kmToX, paginateRows } from "@/lib/terrain/route-tube-pdf";
// Import type-only: erasa a compile-time, jsPDF resta caricato solo dinamicamente al click.
import type { jsPDF } from "jspdf";

/**
 * Pulsante "Scheda telaio (PDF)" (.pipeline/spec.md): scarica un PDF
 * verticale 60x100mm con profilo altimetrico + tabella split salite, pensato
 * per essere stampato e attaccato al tubo del telaio in gara. Nessuna nuova
 * query: tutti i dati arrivano gia' come prop da RouteCardStack. Visibile solo
 * a calibrazione fatta (il chiamante mostra il bottone solo se `estimate` e'
 * presente: senza stima i numeri di pacing sarebbero imprecisi). jsPDF e'
 * importato dinamicamente al click, cosi' non entra nel bundle iniziale.
 */

const PAGE_W_MM = 60;
const PAGE_H_MM = 100;
const MARGIN_MM = 4;
const CONTENT_LEFT = MARGIN_MM;
const CONTENT_WIDTH = PAGE_W_MM - MARGIN_MM * 2; // 52
const CONTENT_BOTTOM = PAGE_H_MM - MARGIN_MM; // 96

const PROFILE_HEIGHT_MM = 30;
const ROW_HEIGHT_MM = 3.4;
const TABLE_HEADER_HEIGHT_MM = 3.4;

interface EventInfo {
  name: string | null;
  start_date_local: string | null;
  distance_km: number | null;
}

function formatDateIt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10));
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

/** Slug del nome gara per il filename; fallback "percorso" (nome assente o vuoto dopo lo slug). */
function slugify(name: string | null): string {
  if (!name) return "percorso";
  // NFD + filtro sui codepoint dei segni diacritici combinanti (0x0300-0x036F):
  // "Rampichilonero" resta leggibile, "Città" -> "citta".
  const withoutDiacritics = Array.from(name.normalize("NFD"))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
  const slug = withoutDiacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "percorso";
}

export function RouteTubePdfButton({
  terrain,
  estimate,
  event,
}: {
  terrain: TerrainSummary;
  estimate: RaceEstimateV2;
  event: EventInfo;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: [PAGE_W_MM, PAGE_H_MM], orientation: "portrait" });
      doc.setTextColor(20, 20, 20);
      doc.setDrawColor(20, 20, 20);

      let y = MARGIN_MM + 3;

      // Intestazione: nome gara, data · distanza · D+, arrivo stimato.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const title = event.name ?? "Gara target";
      const titleLines = doc.splitTextToSize(title, CONTENT_WIDTH) as string[];
      for (const line of titleLines) {
        doc.text(line, CONTENT_LEFT, y);
        y += 3.6;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      const distanceKm = event.distance_km ?? terrain.total_distance_km;
      const infoParts = [
        formatDateIt(event.start_date_local),
        `${distanceKm} km`,
        `${terrain.total_elevation_m} m D+`,
      ].filter((part): part is string => part != null);
      doc.text(infoParts.join(" · "), CONTENT_LEFT, y);
      y += 3;

      doc.text(`Arrivo: ${estimate.pacing.finish_realistic}`, CONTENT_LEFT, y);
      y += 3;

      y += 2;

      // Profilo altimetrico: skip se la polyline non ha abbastanza punti.
      const polyline = terrain.polyline;
      if (polyline.length >= 2) {
        const maxKm = polyline[polyline.length - 1][0] || terrain.total_distance_km || 1;
        const { minElevation, elevationRange } = elevationBounds(polyline);
        const profileTop = y;
        const profileBottom = y + PROFILE_HEIGHT_MM;

        const points = polyline.map(
          (p): [number, number] => [
            kmToX(p[0], maxKm, CONTENT_LEFT, CONTENT_WIDTH),
            elevationToY(p[3], minElevation, elevationRange, profileTop, PROFILE_HEIGHT_MM),
          ]
        );

        // Punti mm per salita (stessa scala colori di mappa/analisi: climbColor,
        // soglie 5%/8%). Salite piu' corte della spaziatura della polyline
        // (~500m, meno di 2 punti nel range) vengono saltate, niente crash.
        const toMm = (p: TerrainSummary["polyline"][number]): [number, number] => [
          kmToX(p[0], maxKm, CONTENT_LEFT, CONTENT_WIDTH),
          elevationToY(p[3], minElevation, elevationRange, profileTop, PROFILE_HEIGHT_MM),
        ];
        const climbSegments = terrain.climbs
          .map((climb) => ({ climb, segment: climbSegmentPoints(polyline, climb).map(toMm) }))
          .filter((c) => c.segment.length >= 2);

        // Aree sotto la traccia colorate per livello di difficolta' (sotto la linea).
        for (const { climb, segment } of climbSegments) {
          const area: Array<[number, number]> = [
            ...segment,
            [segment[segment.length - 1][0], profileBottom],
            [segment[0][0], profileBottom],
          ];
          const areaDeltas = area.slice(1).map((p, i) => [p[0] - area[i][0], p[1] - area[i][1]]);
          doc.setFillColor(climbColor(climb.avg_gradient_pct));
          doc.lines(areaDeltas, area[0][0], area[0][1], [1, 1], "F", true);
        }

        const deltas = points
          .slice(1)
          .map((p, i) => [p[0] - points[i][0], p[1] - points[i][1]]);

        doc.setDrawColor(140, 140, 140);
        doc.setLineWidth(0.3);
        doc.lines(deltas, points[0][0], points[0][1], [1, 1], "S", false);

        // Tratti di salita ricalcati sopra la linea, colorati per difficolta'.
        for (const { climb, segment } of climbSegments) {
          const segDeltas = segment
            .slice(1)
            .map((p, i) => [p[0] - segment[i][0], p[1] - segment[i][1]]);
          doc.setDrawColor(climbColor(climb.avg_gradient_pct));
          doc.setLineWidth(0.3);
          doc.lines(segDeltas, segment[0][0], segment[0][1], [1, 1], "S", false);
        }

        // Marca in ascissa i km-cima delle salite.
        doc.setDrawColor(120, 90, 60);
        doc.setLineWidth(0.25);
        for (const climb of terrain.climbs) {
          const topKm = climb.position_km + climb.distance_km;
          const tx = kmToX(topKm, maxKm, CONTENT_LEFT, CONTENT_WIDTH);
          doc.line(tx, profileBottom, tx, profileBottom - 2.5);
        }

        doc.setDrawColor(20, 20, 20);
        y = profileBottom + 3;
      }

      drawClimbTable(doc, terrain.climbs, estimate, y);

      doc.save(`${slugify(event.name)}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void handleClick()} disabled={busy}>
      {busy ? "Genero PDF…" : "Scheda telaio (PDF)"}
    </Button>
  );
}

/**
 * Tabella split salite: tutte le salite, mai troncate. Paginazione automatica
 * su piu' pagine 60x100mm se non entrano nella pagina corrente (font fisso,
 * niente auto-shrink).
 */
function drawClimbTable(
  doc: jsPDF,
  climbs: Climb[],
  estimate: RaceEstimateV2,
  startY: number
): void {
  let y = startY;

  if (climbs.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("Percorso senza salite categorizzate.", CONTENT_LEFT, y);
    return;
  }

  const headers = ["Salita", "Km cima", "ETA", "W"];
  const widths = [14, 12, 16, 10];
  const colX = widths.map((_, i) =>
    i === 0 ? CONTENT_LEFT : CONTENT_LEFT + widths.slice(0, i).reduce((a, b) => a + b, 0)
  );

  const rows: string[][] = climbs.map((climb, i) => {
    const topKm = (climb.position_km + climb.distance_km).toFixed(1);
    const name = climb.category ?? "Salita";
    const eta = estimate.pacing.key_splits[i]?.eta_formatted ?? "—";
    const w = estimate.climb_estimates[i]?.power_w;
    return [name, topKm, eta, w != null ? `${w}` : "—"];
  });

  const firstPageCapacity = Math.floor(
    (CONTENT_BOTTOM - startY - TABLE_HEADER_HEIGHT_MM) / ROW_HEIGHT_MM
  );
  const otherPageCapacity = Math.floor(
    (CONTENT_BOTTOM - MARGIN_MM - 3 - TABLE_HEADER_HEIGHT_MM) / ROW_HEIGHT_MM
  );
  const pageRowCounts = paginateRows(rows.length, firstPageCapacity, otherPageCapacity);

  let rowIndex = 0;
  pageRowCounts.forEach((count, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage([PAGE_W_MM, PAGE_H_MM], "portrait");
      y = MARGIN_MM + 3;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(20, 20, 20);
    headers.forEach((h, i) => doc.text(h, colX[i], y));
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.15);
    doc.line(CONTENT_LEFT, y + 0.8, CONTENT_LEFT + CONTENT_WIDTH, y + 0.8);
    y += TABLE_HEADER_HEIGHT_MM;

    doc.setFont("helvetica", "normal");
    for (let i = 0; i < count; i++) {
      const row = rows[rowIndex];
      row.forEach((cell, colIndex) => doc.text(cell, colX[colIndex], y));
      y += ROW_HEIGHT_MM;
      rowIndex++;
    }
  });
}
