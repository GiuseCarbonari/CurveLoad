import { NextResponse } from "next/server";

import { calibrateAthlete } from "@/lib/terrain/calibrate";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/profile/calibrate — calibra la firma di velocità (M7).
 *
 * Route sottile: verifica l'identità Supabase e delega a calibrateAthlete()
 * (lib/terrain/calibrate.ts), che scarica le ultime ~20 attività MTB, ne
 * impara la velocità per fascia di pendenza, salva la firma e riattiva la
 * stima tempi v2. Tutto deterministico, nessuna AI.
 */

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "unauthorized", message: "Non autenticato" },
      { status: 401 }
    );
  }

  const result = await calibrateAthlete(user.id);

  if (result.ok) {
    return NextResponse.json({
      success: true,
      signature_level: result.signature_level,
      coverage_pct: result.coverage_pct,
      activities_used: result.activities_used,
      race_estimate_updated: result.race_estimate_updated,
    });
  }

  switch (result.reason) {
    case "not_connected":
      return NextResponse.json(
        { success: false, error: "not_connected", message: "Nessun account Intervals collegato" },
        { status: 409 }
      );
    case "intervals_unauthorized":
      return NextResponse.json(
        { success: false, error: "intervals_unauthorized", message: "Sessione Intervals scaduta — riconnetti" },
        { status: 401 }
      );
    case "api_error":
      return NextResponse.json(
        { success: false, error: "api_error", message: "Lettura attività da Intervals fallita" },
        { status: 502 }
      );
    default:
      return NextResponse.json(
        { success: false, error: "internal_error", message: "Calibrazione fallita, riprova" },
        { status: 500 }
      );
  }
}
