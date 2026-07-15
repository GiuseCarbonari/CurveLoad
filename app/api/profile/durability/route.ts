import { NextResponse } from "next/server";

import { buildAthleteDurability } from "@/lib/profile/durability-io";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/profile/durability — calcola la curva di durabilità (calo di
 * potenza da fresco vs affaticato).
 *
 * Route sottile: verifica l'identità Supabase e delega a
 * buildAthleteDurability() (lib/profile/durability-io.ts), che scarica gli
 * stream watts delle ultime uscite lunghe, calcola il calo per bin di kJ e
 * salva il risultato in athlete_profiles. Tutto deterministico, nessuna AI.
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

  const result = await buildAthleteDurability(user.id);

  if (result.ok) {
    return NextResponse.json({
      success: true,
      durability_index: result.durability_index,
      confidence: result.confidence,
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
    case "insufficient_data":
      return NextResponse.json({
        success: false,
        error: "insufficient_data",
        message: "Servono almeno 3 uscite lunghe (≥90 min) con misuratore di potenza.",
      });
    default:
      return NextResponse.json(
        { success: false, error: "internal_error", message: "Calcolo durabilità fallito, riprova" },
        { status: 500 }
      );
  }
}
