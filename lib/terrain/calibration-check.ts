/**
 * Verifica di calibrazione (M7 fix bias discese) — funzione PURA.
 *
 * Ricostruisce la firma di velocità DAGLI STREAM reali di una gara (con i 3
 * cambi anti-bias di velocity-signature) e ristima il tempo di percorrenza con
 * race-estimator-v2 (NON modificato), per misurare quanto la firma riproduce il
 * tempo reale. Usata sul Rampichilonero (3h08 reali) come banco di prova.
 *
 * Sta in un file separato apposta per non toccare race-estimator-v2 e per non
 * creare cicli (velocity-signature ↔ race-estimator-v2). I dati (stream +
 * terrain) arrivano dal chiamante: la funzione non legge file.
 */

import type { TerrainSummary } from "@/lib/terrain/gpx-parser";
import { estimateRaceTimeV2 } from "@/lib/terrain/race-estimator-v2";
import {
  buildSignatureFromStreams,
  type ActivityStream,
  type VelocitySignature,
} from "@/lib/terrain/velocity-signature";

/** Tempo in movimento reale verificato del Rampichilonero 2024 (3h08). */
export const RAMPICHILONERO_REAL_MOVING_S = 11288;

export interface SignatureValidation {
  signature_buckets: number;
  reliable_buckets: number;
  estimated_moving_s: number;
  estimated_moving_formatted: string;
  real_moving_s: number;
  real_moving_formatted: string;
  error_pct: number;
}

function fmt(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}min`;
}

/**
 * Costruisce la firma dagli stream forniti (con i 3 cambi anti-bias), la usa
 * come firma PERSONALE (livello 1) e stima il tempo realistico sul terrain
 * dato, confrontandolo col tempo reale (default Rampichilonero, 3h08).
 */
export function validateSignatureAgainstRide(
  streams: ActivityStream[],
  terrain: TerrainSummary,
  cpW: number,
  weightKg: number,
  realMovingS: number = RAMPICHILONERO_REAL_MOVING_S
): SignatureValidation {
  const buckets = buildSignatureFromStreams(
    streams,
    terrain.total_distance_km * 1000
  );
  const signature: VelocitySignature = {
    athlete_id: "validation",
    built_at: new Date(0).toISOString(),
    activities_used: 1,
    total_samples: buckets.reduce((s, b) => s + b.sample_count, 0),
    buckets,
    level: 1,
    coverage_pct: 0,
  };

  const est = estimateRaceTimeV2(terrain, signature, cpW, weightKg, null, "realistic");
  const error = ((est.moving_seconds - realMovingS) / realMovingS) * 100;

  return {
    signature_buckets: buckets.length,
    reliable_buckets: buckets.filter((b) => b.reliable).length,
    estimated_moving_s: est.moving_seconds,
    estimated_moving_formatted: fmt(est.moving_seconds),
    real_moving_s: realMovingS,
    real_moving_formatted: fmt(realMovingS),
    error_pct: Number(error.toFixed(1)),
  };
}
