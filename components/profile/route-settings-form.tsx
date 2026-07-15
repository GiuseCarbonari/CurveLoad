"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { Climb } from "@/lib/terrain/gpx-parser";
import {
  REPEATABILITY_PRESETS,
  RIDING_POSITIONS,
  SURFACES,
  cdaForPosition,
  type RaceRouteSettings,
  type RidingPositionKey,
  type SurfaceKey,
} from "@/lib/terrain/route-settings";

/**
 * Input peso bici/posizione in sella/CdA/fondo per salita/margine di
 * ripetibilità (Race Planner M1). POST /api/profile/route-settings, poi
 * router.refresh() (stesso pattern di calibrate-button.tsx). Nessuna nuova
 * dipendenza: <select>/<input type="range"|"number"> nativi.
 */

const INPUT_CLASS =
  "rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand";

export function RouteSettingsForm({
  initialSettings,
  climbs,
}: {
  initialSettings: RaceRouteSettings;
  climbs: Climb[];
}) {
  const router = useRouter();
  const [bikeWeightKg, setBikeWeightKg] = useState<string>(
    initialSettings.bike_weight_kg != null ? String(initialSettings.bike_weight_kg) : ""
  );
  const [ridingPosition, setRidingPosition] = useState<RidingPositionKey | "custom">(
    initialSettings.riding_position
  );
  const [cdaM2, setCdaM2] = useState<string>(String(initialSettings.cda_m2));
  const [climbSurfaces, setClimbSurfaces] = useState<Record<string, SurfaceKey>>(
    initialSettings.climb_surfaces
  );
  const [repeatabilityPct, setRepeatabilityPct] = useState<number>(
    Math.round(initialSettings.repeatability_frac * 100)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRidingPositionChange(next: RidingPositionKey | "custom") {
    setRidingPosition(next);
    if (next !== "custom") setCdaM2(String(cdaForPosition(next)));
  }

  function handleClimbSurfaceChange(index: number, surface: SurfaceKey) {
    setClimbSurfaces((prev) => ({ ...prev, [String(index)]: surface }));
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const settings: RaceRouteSettings = {
        bike_weight_kg: bikeWeightKg.trim() === "" ? null : Number(bikeWeightKg),
        riding_position: ridingPosition,
        cda_m2: Number(cdaM2),
        climb_surfaces: climbSurfaces,
        repeatability_frac: repeatabilityPct / 100,
      };
      const response = await fetch("/api/profile/route-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(body?.message ?? "Salvataggio fallito");
        return;
      }
      router.refresh();
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <h3 className="text-base font-medium text-foreground">
        Peso bici, posizione e strategia
      </h3>
      <p className="mt-1 text-sm text-secondary">
        Affina la stima con i dati del tuo mezzo e quanto vuoi rischiare in gara.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="bike-weight" className="text-sm font-medium text-foreground">
            Peso bici (kg)
          </label>
          <input
            id="bike-weight"
            type="number"
            min="0"
            step="0.1"
            value={bikeWeightKg}
            onChange={(e) => setBikeWeightKg(e.target.value)}
            placeholder="es. 9.5"
            className={`mt-1.5 block w-full ${INPUT_CLASS}`}
          />
          <p className="mt-1.5 text-xs leading-5 text-faint">
            Il peso della bici rallenta la salita rispetto a una bici di
            riferimento (~13 kg): più pesa, più la salita rallenta. Lascia
            vuoto se non lo conosci (nessuna correzione). Valore v0, tarabile.
          </p>
        </div>

        <div>
          <label htmlFor="riding-position" className="text-sm font-medium text-foreground">
            Posizione in sella
          </label>
          <select
            id="riding-position"
            value={ridingPosition}
            onChange={(e) => handleRidingPositionChange(e.target.value as RidingPositionKey | "custom")}
            className={`mt-1.5 block w-full ${INPUT_CLASS}`}
          >
            {RIDING_POSITIONS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            <option value="custom">Personalizzato</option>
          </select>
          {ridingPosition === "custom" && (
            <div className="mt-2">
              <label htmlFor="cda-m2" className="text-xs text-muted">
                CdA (m²) — valori di riferimento v0, tarabili
              </label>
              <input
                id="cda-m2"
                type="number"
                min="0.15"
                max="0.6"
                step="0.01"
                value={cdaM2}
                onChange={(e) => setCdaM2(e.target.value)}
                className={`mt-1 block w-full ${INPUT_CLASS}`}
              />
            </div>
          )}
          <p className="mt-1.5 text-xs leading-5 text-faint">
            Influisce solo sui tratti veloci/pianeggianti quando la stima usa il
            modello fisico: in salita ripida cambia pochissimo i tempi.
          </p>
        </div>
      </div>

      {climbs.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-foreground">Fondo per salita</h4>
          <div className="mt-2 space-y-2">
            {climbs.map((climb, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-secondary">
                  Salita {index + 1} (km {climb.position_km}, {climb.avg_gradient_pct}%)
                </span>
                <select
                  aria-label={`Fondo salita ${index + 1}`}
                  value={climbSurfaces[String(index)] ?? "asphalt_rough"}
                  onChange={(e) => handleClimbSurfaceChange(index, e.target.value as SurfaceKey)}
                  className={INPUT_CLASS}
                >
                  {SURFACES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs leading-5 text-faint">
            Il fondo scelto corregge sempre la velocità di salita rispetto a un
            fondo di riferimento (sterrato compatto): più il fondo è ostile,
            più la salita rallenta. Valori Crr di riferimento v0, tarabili.
          </p>
        </div>
      )}

      <div className="mt-6">
        <label htmlFor="repeatability" className="text-sm font-medium text-foreground">
          Margine di ripetibilità: {repeatabilityPct}%
        </label>
        <p className="mt-1 text-xs leading-5 text-faint">
          Più conservativo = target di potenza più basso, più sicuro di reggere
          tutta la salita.
        </p>
        <input
          id="repeatability"
          type="range"
          min="85"
          max="100"
          step="1"
          value={repeatabilityPct}
          onChange={(e) => setRepeatabilityPct(Number(e.target.value))}
          className="mt-2 w-full"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {REPEATABILITY_PRESETS.map((preset) => (
            <Button
              key={preset.key}
              type="button"
              variant={Math.round(preset.frac * 100) === repeatabilityPct ? "default" : "outline"}
              size="sm"
              onClick={() => setRepeatabilityPct(Math.round(preset.frac * 100))}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-start gap-1.5">
        <Button onClick={() => void handleSave()} disabled={loading}>
          {loading ? "Salvo…" : "Salva impostazioni"}
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </section>
  );
}
