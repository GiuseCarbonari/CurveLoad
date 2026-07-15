import assert from "node:assert/strict";
import { test } from "node:test";

import type { Climb } from "../lib/terrain/gpx-parser";
import {
  cdaForPosition,
  crrForSurface,
  defaultRouteSettings,
  routeSettingsToOpts,
  sanitizeRouteSettings,
  surfaceForClimb,
} from "../lib/terrain/route-settings";

/**
 * Self-check di lib/terrain/route-settings.ts (Race Planner M1): lookup
 * cataloghi CdA/Crr e clamp/robustezza di sanitizeRouteSettings (trust
 * boundary: input dalla route POST).
 */

test("cdaForPosition/crrForSurface: tornano i valori attesi", () => {
  assert.equal(cdaForPosition("hoods"), 0.36);
  assert.equal(cdaForPosition("aero"), 0.24);
  assert.equal(crrForSurface("asphalt_rough"), 0.007);
  assert.equal(crrForSurface("gravel_loose"), 0.016);
});

test("sanitizeRouteSettings: null/undefined/{} → default, mai lancia", () => {
  const def = defaultRouteSettings();
  assert.deepEqual(sanitizeRouteSettings(null), def);
  assert.deepEqual(sanitizeRouteSettings(undefined), def);
  assert.deepEqual(sanitizeRouteSettings({}), def);
});

test("sanitizeRouteSettings: clamp repeatability_frac a [0.85, 1.0]", () => {
  assert.equal(sanitizeRouteSettings({ repeatability_frac: 0.5 }).repeatability_frac, 0.85);
  assert.equal(sanitizeRouteSettings({ repeatability_frac: 2 }).repeatability_frac, 1.0);
  assert.equal(sanitizeRouteSettings({ repeatability_frac: NaN }).repeatability_frac, 1.0);
  assert.equal(sanitizeRouteSettings({ repeatability_frac: 0.9 }).repeatability_frac, 0.9);
});

test("sanitizeRouteSettings: clamp cda_m2 a [0.15, 0.60]", () => {
  assert.equal(sanitizeRouteSettings({ cda_m2: 0.05 }).cda_m2, 0.15);
  assert.equal(sanitizeRouteSettings({ cda_m2: 1.0 }).cda_m2, 0.6);
  assert.equal(sanitizeRouteSettings({ cda_m2: 0.3 }).cda_m2, 0.3);
});

test("sanitizeRouteSettings: bike_weight_kg negativo/NaN → null, cap 30kg", () => {
  assert.equal(sanitizeRouteSettings({ bike_weight_kg: -5 }).bike_weight_kg, null);
  assert.equal(sanitizeRouteSettings({ bike_weight_kg: NaN }).bike_weight_kg, null);
  assert.equal(sanitizeRouteSettings({ bike_weight_kg: 999 }).bike_weight_kg, 30);
  assert.equal(sanitizeRouteSettings({ bike_weight_kg: 9.5 }).bike_weight_kg, 9.5);
});

test("sanitizeRouteSettings: climb_surfaces ignora chiavi/valori invalidi", () => {
  const s = sanitizeRouteSettings({
    climb_surfaces: { "0": "gravel_firm", "1": "not_a_surface", abc: "asphalt_rough" },
  });
  assert.deepEqual(s.climb_surfaces, { "0": "gravel_firm" });
});

test("surfaceForClimb: indice assente → DEFAULT_SURFACE", () => {
  const settings = sanitizeRouteSettings({ climb_surfaces: { "0": "gravel_loose" } });
  assert.equal(surfaceForClimb(settings, 0), "gravel_loose");
  assert.equal(surfaceForClimb(settings, 5), "asphalt_rough");
});

test("routeSettingsToOpts: risolve climb_crr/climb_surface per indice", () => {
  const climbs: Climb[] = [
    {
      position_km: 10,
      distance_km: 5,
      elevation_m: 300,
      avg_gradient_pct: 6,
      max_gradient_pct: 9,
      category: "Cat 2",
      start_coords: { lat: 45, lon: 7 },
      end_coords: { lat: 45.1, lon: 7.1 },
    },
    {
      position_km: 30,
      distance_km: 3,
      elevation_m: 200,
      avg_gradient_pct: 7,
      max_gradient_pct: 10,
      category: "Cat 3",
      start_coords: { lat: 45.2, lon: 7.2 },
      end_coords: { lat: 45.3, lon: 7.3 },
    },
  ];
  const settings = sanitizeRouteSettings({
    bike_weight_kg: 9,
    cda_m2: 0.3,
    repeatability_frac: 0.95,
    climb_surfaces: { "0": "gravel_loose" },
  });
  const opts = routeSettingsToOpts(settings, climbs);
  assert.equal(opts.bike_weight_kg, 9);
  assert.equal(opts.cda_m2, 0.3);
  assert.equal(opts.repeatability_frac, 0.95);
  assert.deepEqual(opts.climb_crr, [0.016, 0.007]); // gravel_loose, default asphalt_rough
  assert.deepEqual(opts.climb_surface, ["gravel_loose", "asphalt_rough"]);
});

test("SURFACES esteso (M1.1): nuove key MTB estreme accettate ovunque", () => {
  assert.equal(crrForSurface("deep_mud"), 0.06);
  assert.equal(crrForSurface("trail_rough"), 0.025);
  assert.equal(crrForSurface("roots_rocks"), 0.035);
  assert.equal(crrForSurface("rocky_field"), 0.045);

  const s = sanitizeRouteSettings({ climb_surfaces: { "0": "deep_mud" } });
  assert.deepEqual(s.climb_surfaces, { "0": "deep_mud" });
});
