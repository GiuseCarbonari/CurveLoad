"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";

import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import { climbColor, climbSegmentPoints } from "@/lib/terrain/route-map-segments";

/**
 * Mappa Leaflet del percorso (Race Planner M3). Import statico di leaflet/
 * react-leaflet: questo file richiede `window`, va caricato SOLO via
 * `route-map-lazy.tsx` (`dynamic(..., { ssr: false })`). Nessun nuovo
 * parsing: riusa `TerrainSummary` già calcolato da gpx-parser.ts.
 *
 * Colori identici a `climbVisual()` in event-analysis.tsx (soglie 5%/8%):
 * single source di verità sulle soglie, qui solo gli hex per la polyline.
 */

// Tratto base: scuro + alone bianco per restare leggibile sul verde/marrone
// dei tile OSM (il precedente #94a3b8 sottile si mimetizzava sullo sfondo).
const BASE_TRACK_COLOR = "#202020";
const BASE_TRACK_HALO_COLOR = "#ffffff";

/** `bounds` di MapContainer si applica solo al mount: qui si aggiorna la
 * vista ogni volta che il percorso (quindi `bounds`) cambia davvero. */
function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(bounds)]);
  return null;
}

export function RouteMap({ terrain }: { terrain: TerrainSummary }): JSX.Element {
  const polyline = terrain.polyline.filter(
    (p) => Number.isFinite(p[1]) && Number.isFinite(p[2])
  );

  if (polyline.length < 2) {
    return (
      <p className="px-3 py-10 text-sm text-muted">
        Mappa del percorso non disponibile.
      </p>
    );
  }

  const positions: LatLngTuple[] = polyline.map((p) => [p[1], p[2]]);
  const bounds: LatLngBoundsExpression = positions;
  const start = positions[0];
  const end = positions[positions.length - 1];

  return (
    <MapContainer
      bounds={bounds}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-[11px] sm:h-80"
    >
      <FitBounds bounds={bounds} />

      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      {/* Alone bianco sotto il tratto scuro: leggibile anche sul verde/marrone dei tile. */}
      <Polyline positions={positions} pathOptions={{ color: BASE_TRACK_HALO_COLOR, weight: 6, opacity: 0.9 }} />
      <Polyline positions={positions} pathOptions={{ color: BASE_TRACK_COLOR, weight: 3, opacity: 1 }} />

      {terrain.climbs.map((climb, index) => {
        const points = climbSegmentPoints(polyline, climb);
        if (points.length < 2) return null;
        const segment: LatLngTuple[] = points.map((p) => [p[1], p[2]]);
        return (
          <Polyline
            key={`halo-${index}`}
            positions={segment}
            pathOptions={{ color: BASE_TRACK_HALO_COLOR, weight: 7, opacity: 0.9 }}
          />
        );
      })}
      {terrain.climbs.map((climb, index) => {
        const points = climbSegmentPoints(polyline, climb);
        if (points.length < 2) return null;
        const segment: LatLngTuple[] = points.map((p) => [p[1], p[2]]);
        return (
          <Polyline
            key={`climb-${index}`}
            positions={segment}
            pathOptions={{ color: climbColor(climb.avg_gradient_pct), weight: 4, opacity: 1 }}
          />
        );
      })}

      <CircleMarker center={start} radius={6} pathOptions={{ color: "#ffffff", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }}>
        <Tooltip>Partenza</Tooltip>
      </CircleMarker>
      <CircleMarker center={end} radius={6} pathOptions={{ color: "#ffffff", fillColor: "#f2553d", fillOpacity: 1, weight: 2 }}>
        <Tooltip>Arrivo</Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
