import { NextResponse } from "next/server";

import { syncIntervalsData } from "@/lib/intervals/sync";
import { autoCalibrateIfNeeded } from "@/lib/terrain/calibrate";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/sync/intervals — sincronizza i dati Intervals dell'utente.
 *
 * Route sottile: verifica l'identità Supabase del chiamante e delega a
 * syncIntervalsData() (lib/intervals/sync.ts), che contiene tutta la logica.
 * La risposta non contiene mai il token né dati grezzi: il client rilegge
 * lo snapshot dal database via RLS.
 */
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

  const outcome = await syncIntervalsData(user.id);

  if (outcome.ok) {
    // Trigger calibrazione automatica (M7): fire-and-forget, NON blocca il
    // sync. Parte solo se la firma manca e l'atleta ha già >5 uscite MTB.
    void autoCalibrateIfNeeded(user.id);

    return NextResponse.json({
      success: true,
      readiness: outcome.readiness,
      snapshot_id: outcome.snapshotId,
    });
  }

  switch (outcome.reason) {
    case "not_connected":
      return NextResponse.json(
        {
          success: false,
          error: "not_connected",
          message: "Nessun account Intervals collegato",
        },
        { status: 409 }
      );
    case "intervals_unauthorized":
      // Il token è già stato cancellato dal DB dentro syncIntervalsData.
      return NextResponse.json(
        {
          success: false,
          error: "intervals_unauthorized",
          message: "Sessione Intervals scaduta — riconnetti",
        },
        { status: 401 }
      );
    case "api_error":
      return NextResponse.json(
        {
          success: false,
          error: "api_error",
          message: `Intervals.icu ha risposto con un errore (HTTP ${outcome.status})`,
        },
        { status: 502 }
      );
    default:
      return NextResponse.json(
        {
          success: false,
          error: "internal_error",
          message: "Sincronizzazione fallita, riprova",
        },
        { status: 500 }
      );
  }
}
