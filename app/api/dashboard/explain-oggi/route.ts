import { NextResponse } from "next/server";

import { explainTodayReadiness } from "@/lib/dashboard/explain-oggi-io";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/dashboard/explain-oggi — genera il commento AI "Spiega la mia
 * giornata" (Passo 6).
 *
 * Route sottile sul modello di /api/profile/explain: verifica l'identità
 * Supabase e delega a explainTodayReadiness() (lib/dashboard/explain-oggi-io.ts).
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

  const result = await explainTodayReadiness(user.id);

  if (result.ok) {
    return NextResponse.json({
      success: true,
      comment: result.comment,
      generated_at: result.generated_at,
    });
  }

  switch (result.reason) {
    case "no_data":
      return NextResponse.json(
        {
          success: false,
          error: "no_data",
          message: "Sincronizza prima i tuoi dati («Aggiorna dati»).",
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
