"use client";

import dynamic from "next/dynamic";

import type { TerrainSummary } from "@/lib/terrain/gpx-parser";

/**
 * Wrapper client per il dynamic import `ssr:false` di `route-map.tsx`
 * (Leaflet richiede `window`). `event-analysis.tsx` è un server component,
 * quindi non può chiamare `dynamic(..., { ssr:false })` direttamente: per
 * questo esiste questo file, marcato `"use client"`.
 */

function MapPlaceholder() {
  return (
    <div className="flex h-64 w-full items-center justify-center rounded-[11px] bg-surface-2 text-sm text-muted sm:h-80">
      Caricamento mappa…
    </div>
  );
}

const RouteMap = dynamic(
  () => import("@/components/profile/route-map").then((m) => m.RouteMap),
  { ssr: false, loading: () => <MapPlaceholder /> }
);

export function RouteMapLazy({
  terrain,
  selectedClimb,
  onSelectClimb,
  heightClass,
  showMyLocation,
  onLocationError,
}: {
  terrain: TerrainSummary;
  selectedClimb?: number | null;
  onSelectClimb?: (idx: number | null) => void;
  heightClass?: string;
  showMyLocation?: boolean;
  onLocationError?: (msg: string | null) => void;
}) {
  return (
    <RouteMap
      terrain={terrain}
      selectedClimb={selectedClimb}
      onSelectClimb={onSelectClimb}
      heightClass={heightClass}
      showMyLocation={showMyLocation}
      onLocationError={onLocationError}
    />
  );
}
