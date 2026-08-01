import { NextResponse } from "next/server";

import { explainRoutePercorso } from "@/lib/profile/explain-percorso-io";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/profile/explain-percorso — genera il commento AI "Spiega il
 * percorso" (Passo 6).
 *
 * Route sottile sul modello di /api/profile/explain: verifica l'identità
 * Supabase e delega a explainRoutePercorso() (lib/profile/explain-percorso-io.ts).
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

  const result = await explainRoutePercorso(user.id);

  if (result.ok) {
    return NextResponse.json({
      success: true,
      comment: result.comment,
      generated_at: result.generated_at,
    });
  }

  switch (result.reason) {
    case "no_analysis":
      return NextResponse.json(
        {
          success: false,
          error: "no_analysis",
          message: "Analizza prima una gara (nella pagina Percorso).",
        },
        { status: 409 }
      );
    case "no_api_key":
      return NextResponse.json(
        {
          success: false,
          error: "no_api_key",
          message: "Commento AI non configurato su questo server.",
        },
        { status: 409 }
      );
    case "invalid_user_key":
      return NextResponse.json(
        {
          success: false,
          error: "invalid_user_key",
          message: "La tua API key Groq non è valida: controllala nelle impostazioni.",
        },
        { status: 409 }
      );
    case "ai_error":
      return NextResponse.json(
        {
          success: false,
          error: "ai_error",
          message: "Generazione del commento fallita, riprova tra poco.",
        },
        { status: 502 }
      );
    default:
      return NextResponse.json(
        { success: false, error: "internal_error", message: "Errore interno, riprova" },
        { status: 500 }
      );
  }
}
