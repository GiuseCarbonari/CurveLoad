"use client";

import { useEffect, useRef, useState } from "react";
import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import { climbColor, climbSegmentPoints } from "@/lib/terrain/route-map-segments";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Mappa 3D del percorso (Race Planner) con MapLibre GL JS: terreno 3D
 * (rilievo da DEM) + texture satellitare drappeggiata, stile Mowi/Komoot.
 * Sostituisce la precedente mappa 2D Leaflet. Import statico di maplibre-gl:
 * questo file richiede `window`/WebGL, va caricato SOLO via
 * `route-map-lazy.tsx` (`dynamic(..., { ssr: false })`). Nessun nuovo
 * parsing: riusa `TerrainSummary` già calcolato da gpx-parser.ts e riusa
 * `climbSegmentPoints`/`climbColor` da route-map-segments.ts (stessa fonte
 * di verità delle soglie 5%/8%, non duplicare).
 *
 * Nessuna chiave/account richiesti: tile satellitari Esri (già usati nella
 * vecchia mappa 2D) + DEM AWS Terrarium (bucket S3 pubblico, best-effort
 * senza SLA — rischio accettato, vedi .pipeline/spec.md).
 */

// Tratto base: scuro + alone bianco per restare leggibile sul verde/marrone
// del drape satellitare (stessi colori della vecchia mappa Leaflet).
const BASE_TRACK_COLOR = "#606060";
const BASE_TRACK_HALO_COLOR = "#ffffff";

// Texture satellitare drappeggiata sul terreno 3D (stessa fonte del vecchio layer "satellite").
// Attenzione ordine assi: Esri usa {z}/{y}/{x} (non lo standard XYZ).
const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIB = "Tiles © Esri";

// DEM per il rilievo 3D: Mapterhorn (encoding Terrarium), nessuna chiave.
// Sostituisce il bucket S3 AWS Terrarium: quel bucket non invia header CORS
// (Access-Control-Allow-Origin assente anche con Origin esplicito, verificato
// via curl), quindi il browser blocca la lettura dei pixel DEM e la mappa
// resta vuota — non un bug di questo file, un limite del provider. Mapterhorn
// serve lo stesso encoding "terrarium" con CORS abilitato (verificato: `Access-
// Control-Allow-Origin: *` sui tile reali), copertura globale, nessuna chiave.
// Attenzione ordine assi: Terrarium/Mapterhorn usa {z}/{x}/{y} (standard XYZ, diverso da Esri sopra).
const TERRAIN_DEM_TILES = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp";
const DEM_ENCODING = "terrarium" as const; // encoding nativo supportato da MapLibre raster-dem
const TERRAIN_EXAGGERATION = 1.4; // knob estetico (vedi OPEN QUESTION 3 della spec)

function mapStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        attribution: SATELLITE_ATTRIB,
        maxzoom: 19,
      },
      "terrain-dem": {
        type: "raster-dem",
        tiles: [TERRAIN_DEM_TILES],
        tileSize: 512, // Mapterhorn serve tile 512px (verificato via TileJSON), non 256
        encoding: DEM_ENCODING,
        maxzoom: 12, // oltre, 404 (verificato via curl); MapLibre fa overzoom da solo
        attribution: "DEM: © Mapterhorn",
      },
    },
    // Nessun layer "sky": maplibre-gl 4.7.1 non lo supporta né a runtime né a
    // tipi (non è solo un gap di tipi come sembrava — lo stile viene RIFIUTATO
    // in blocco con "layers[1].type: expected one of [...], 'sky' found",
    // quindi l'intera mappa restava vuota, non solo il cielo). Puramente
    // estetico, si può reintrodurre se un giorno si aggiorna maplibre-gl a una
    // versione che lo supporta davvero.
    layers: [{ id: "satellite", type: "raster", source: "satellite" }],
    terrain: { source: "terrain-dem", exaggeration: TERRAIN_EXAGGERATION },
  };
}

/** FeatureCollection LineString unico, colore per feature via property "color".
 * ponytail: un source, color da property, invece di N layer per segmento. */
function segmentsGeoJSON(
  segments: Array<{ points: TerrainSummary["polyline"]; color: string }>
): GeoJSON.FeatureCollection<GeoJSON.LineString, { color: string }> {
  return {
    type: "FeatureCollection",
    features: segments.map(({ points, color }) => ({
      type: "Feature",
      properties: { color },
      geometry: {
        type: "LineString",
        // Coordinate MapLibre: [lon, lat] (GeoJSON), non [lat, lon] come Leaflet.
        // polyline è [km, lat, lon, ele] -> punto mappa è [p[2], p[1]].
        coordinates: points.map((p) => [p[2], p[1]]),
      },
    })),
  };
}

function markerElement(fill: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "12px";
  el.style.height = "12px";
  el.style.borderRadius = "50%";
  el.style.background = fill;
  el.style.border = "2px solid #ffffff";
  el.style.boxShadow = "0 0 2px rgba(0,0,0,0.4)";
  return el;
}

export function RouteMap({ terrain }: { terrain: TerrainSummary }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglError, setWebglError] = useState(false);

  const polyline = terrain.polyline.filter(
    (p) => Number.isFinite(p[1]) && Number.isFinite(p[2])
  );

  useEffect(() => {
    if (polyline.length < 2 || !containerRef.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: mapStyle(),
        pitch: 60,
        bearing: -15,
        interactive: true,
      });
    } catch {
      // WebGL non disponibile (device/browser vecchio, GPU blocklisted).
      setWebglError(true);
      return;
    }

    map.scrollZoom.disable(); // replica scrollWheelZoom={false} del vecchio Leaflet
    map.addControl(
      // ponytail: controllo nativo, no bottone custom
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right"
    );

    map.on("load", () => {
      const lons = polyline.map((p) => p[2]);
      const lats = polyline.map((p) => p[1]);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ];
      map.fitBounds(bounds, { padding: 40, animate: false });

      // Tracciato base: alone bianco sotto, linea scura sopra.
      map.addSource("base-track", {
        type: "geojson",
        data: segmentsGeoJSON([{ points: polyline, color: BASE_TRACK_COLOR }]),
      });
      map.addLayer({
        id: "base-track-halo",
        type: "line",
        source: "base-track",
        paint: { "line-color": BASE_TRACK_HALO_COLOR, "line-width": 6, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "base-track",
        type: "line",
        source: "base-track",
        paint: { "line-color": BASE_TRACK_COLOR, "line-width": 3, "line-opacity": 1 },
      });

      // Segmenti salita: colore per pendenza, riusando climbSegmentPoints/climbColor.
      const climbSegments = terrain.climbs
        .map((climb) => ({
          points: climbSegmentPoints(polyline, climb),
          color: climbColor(climb.avg_gradient_pct),
        }))
        .filter((s) => s.points.length >= 2); // stesso guard del vecchio file

      if (climbSegments.length > 0) {
        const climbData = segmentsGeoJSON(climbSegments);
        map.addSource("climb-segments", { type: "geojson", data: climbData });
        map.addLayer({
          id: "climb-segments-halo",
          type: "line",
          source: "climb-segments",
          paint: { "line-color": BASE_TRACK_HALO_COLOR, "line-width": 7, "line-opacity": 0.9 },
        });
        map.addLayer({
          id: "climb-segments",
          type: "line",
          source: "climb-segments",
          paint: { "line-color": ["get", "color"], "line-width": 4, "line-opacity": 1 },
        });
      }

      // Marker partenza/arrivo (polyline già filtrata: coordinate finite).
      const start = polyline[0];
      const end = polyline[polyline.length - 1];
      new maplibregl.Marker({ element: markerElement("#22c55e") })
        .setLngLat([start[2], start[1]])
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 10 }).setText("Partenza"))
        .addTo(map);
      new maplibregl.Marker({ element: markerElement("#f2553d") })
        .setLngLat([end[2], end[1]])
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 10 }).setText("Arrivo"))
        .addTo(map);
    });

    return () => map.remove();
    // Dep sui dati del percorso (stesso pattern del vecchio FitBounds): un
    // nuovo `terrain` distrugge e ricrea la mappa, niente istanze orfane.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(polyline)]);

  if (polyline.length < 2) {
    return (
      <p className="px-3 py-10 text-sm text-muted">
        Mappa del percorso non disponibile.
      </p>
    );
  }

  if (webglError) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-[11px] bg-surface-2 px-3 text-center text-sm text-muted sm:h-80">
        Mappa 3D non disponibile su questo dispositivo.
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="h-64 w-full rounded-[11px] sm:h-80" />
    </div>
  );
}
