"use client";

import { useEffect, useRef, useState } from "react";
import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import { climbColor, climbSegmentPoints } from "@/lib/terrain/route-map-segments";
import { cn } from "@/lib/utils";
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
  segments: Array<{ points: TerrainSummary["polyline"]; color: string; climbIdx?: number }>
): GeoJSON.FeatureCollection<GeoJSON.LineString, { color: string; climbIdx: number }> {
  return {
    type: "FeatureCollection",
    features: segments.map(({ points, color, climbIdx }) => ({
      type: "Feature",
      properties: { color, climbIdx: climbIdx ?? -1 },
      geometry: {
        type: "LineString",
        // Coordinate MapLibre: [lon, lat] (GeoJSON), non [lat, lon] come Leaflet.
        // polyline è [km, lat, lon, ele] -> punto mappa è [p[2], p[1]].
        coordinates: points.map((p) => [p[2], p[1]]),
      },
    })),
  };
}

/** Testo compatto del popup di una salita selezionata (vedi spec "Popup"). */
function climbPopupText(climb: TerrainSummary["climbs"][number]): string {
  return (
    `Pos. ${climb.position_km} km · ${climb.distance_km} km · ` +
    `${climb.elevation_m} m D+ · ${climb.avg_gradient_pct}% · Cat. ${climb.category ?? "—"}`
  );
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

function locationMarkerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "16px";
  el.style.height = "16px";
  el.style.borderRadius = "50%";
  el.style.background = "#2563eb"; // blu "current location", diverso da verde/rosso start/arrivo
  el.style.border = "3px solid #ffffff";
  el.style.boxShadow = "0 0 6px rgba(37,99,235,0.8)";
  el.style.animation = "pulseDot 1.5s ease-in-out infinite"; // keyframe già presente in globals.css
  return el;
}

export function RouteMap({
  terrain,
  selectedClimb = null,
  onSelectClimb,
  heightClass,
  showMyLocation = false,
  onLocationError,
}: {
  terrain: TerrainSummary;
  /** Indice in terrain.climbs da evidenziare dall'esterno (tabella salite). */
  selectedClimb?: number | null;
  /** Notifica click su una salita (o `null` su click su area vuota). */
  onSelectClimb?: (idx: number | null) => void;
  /** Override altezza contenitore mappa (default invariato: h-64 sm:h-80). */
  heightClass?: string;
  /** Attiva il marker GPS live "tu sei qui" (watchPosition). Default off. */
  showMyLocation?: boolean;
  /** Notifica errore geolocalizzazione (messaggio breve IT) o `null` su fix riuscito. */
  onLocationError?: (msg: string | null) => void;
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [webglError, setWebglError] = useState(false);

  const polyline = terrain.polyline.filter(
    (p) => Number.isFinite(p[1]) && Number.isFinite(p[2])
  );

  // Ref sempre aggiornata: gli handler del click (dentro l'effect che crea la
  // mappa, con dep solo su `polyline`) devono poter chiamare la ultima
  // `onSelectClimb` senza ricreare la mappa a ogni cambio di prop.
  const onSelectClimbRef = useRef(onSelectClimb);
  onSelectClimbRef.current = onSelectClimb;

  // Ref sempre aggiornata: i callback di watchPosition (registrati una sola
  // volta nell'effect sotto) devono poter chiamare l'ultima `onLocationError`
  // senza far ripartire l'effect (stesso pattern di onSelectClimbRef sopra).
  const onLocationErrorRef = useRef(onLocationError);
  onLocationErrorRef.current = onLocationError;

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
        attributionControl: false, // riaggiunta sotto in top-right: quella di default in bottom-left copre il bottom sheet
      });
    } catch {
      // WebGL non disponibile (device/browser vecchio, GPU blocklisted).
      setWebglError(true);
      return;
    }

    mapRef.current = map;

    map.scrollZoom.disable(); // replica scrollWheelZoom={false} del vecchio Leaflet
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");
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
      // climbIdx = indice in terrain.climbs, per selezione/click (vedi effect separato sotto).
      const climbSegments = terrain.climbs
        .map((climb, climbIdx) => ({
          points: climbSegmentPoints(polyline, climb),
          color: climbColor(climb.avg_gradient_pct),
          climbIdx,
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

        // Click su una salita -> notifica selezione; click su area vuota -> deseleziona.
        map.on("click", "climb-segments", (e) => {
          const idx = e.features?.[0]?.properties?.climbIdx;
          if (typeof idx === "number") onSelectClimbRef.current?.(idx);
        });
        map.on("click", (e) => {
          const hits = map.queryRenderedFeatures(e.point, { layers: ["climb-segments"] });
          if (hits.length === 0) onSelectClimbRef.current?.(null);
        });
        map.on("mouseenter", "climb-segments", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "climb-segments", () => {
          map.getCanvas().style.cursor = "";
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

    return () => {
      mapRef.current = null;
      popupRef.current = null;
      map.remove();
    };
    // Dep sui dati del percorso (stesso pattern del vecchio FitBounds): un
    // nuovo `terrain` distrugge e ricrea la mappa, niente istanze orfane.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(polyline)]);

  // Selezione -> evidenzia il segmento e mostra il popup. Effect separato
  // dalla creazione della mappa: NON deve ricreare/distruggere la mappa a
  // ogni cambio di selezione (vedi spec "selectedClimb must not recreate the
  // map"), lavora sull'istanza esistente via mapRef.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("climb-segments")) return;

    map.setPaintProperty("climb-segments", "line-width", [
      "case",
      ["==", ["get", "climbIdx"], selectedClimb ?? -1],
      7,
      4,
    ]);
    map.setPaintProperty("climb-segments", "line-opacity", [
      "case",
      ["==", ["get", "climbIdx"], selectedClimb ?? -1],
      1,
      selectedClimb == null ? 1 : 0.55,
    ]);

    popupRef.current?.remove();
    popupRef.current = null;

    const climb = selectedClimb != null ? terrain.climbs[selectedClimb] : null;
    if (climb) {
      popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 10 })
        .setLngLat([climb.start_coords.lon, climb.start_coords.lat])
        .setText(climbPopupText(climb))
        .addTo(map);
    }
  }, [selectedClimb, terrain.climbs]);

  // Marker GPS live "tu sei qui". Effect separato, dep solo su
  // `showMyLocation`: NON deve ricreare/distruggere la mappa (stesso vincolo
  // dell'effect di selezione sopra), lavora su mapRef.current esistente. Mai
  // auto-recenter: ogni fix chiama solo setLngLat sul marker, mai
  // flyTo/easeTo/panTo (vedi spec).
  useEffect(() => {
    if (!showMyLocation) return; // off: nothing to start; cleanup below handles teardown

    if (!("geolocation" in navigator)) {
      onLocationErrorRef.current?.("Geolocalizzazione non supportata su questo dispositivo.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const map = mapRef.current;
        // Oltre a "map esiste", lo stile deve essere completamente caricato:
        // un fix GPS può arrivare prima dell'evento "load" (i marker
        // partenza/arrivo sopra vengono aggiunti solo dentro map.on("load", ...)
        // per lo stesso motivo). Aggiungere un Marker mentre MapLibre sta
        // ancora processando le sorgenti/lo stile fa scattare un redraw interno
        // che assume sorgenti già pronte (crash "clearFadeHold" osservato).
        if (!map || !map.isStyleLoaded()) return;
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        if (!locationMarkerRef.current) {
          locationMarkerRef.current = new maplibregl.Marker({ element: locationMarkerElement() })
            .setLngLat(lngLat)
            .addTo(map);
        } else {
          locationMarkerRef.current.setLngLat(lngLat); // reposition existing marker, no re-init
        }
        onLocationErrorRef.current?.(null); // clear any prior error on a good fix
      },
      (err) => {
        onLocationErrorRef.current?.(
          err.code === err.PERMISSION_DENIED
            ? "Permesso posizione negato. Attivalo nelle impostazioni del browser."
            : "Posizione non disponibile."
        );
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      locationMarkerRef.current?.remove();
      locationMarkerRef.current = null;
    };
  }, [showMyLocation]);

  if (polyline.length < 2) {
    return (
      <p className="px-3 py-10 text-sm text-muted">
        Mappa del percorso non disponibile.
      </p>
    );
  }

  if (webglError) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-[11px] bg-surface-2 px-3 text-center text-sm text-muted",
          heightClass ?? "h-64 sm:h-80"
        )}
      >
        Mappa 3D non disponibile su questo dispositivo.
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", heightClass ?? "h-64 sm:h-80")}>
      <div ref={containerRef} className="h-full w-full rounded-[11px]" />
    </div>
  );
}
