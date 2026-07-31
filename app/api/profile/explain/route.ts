import { NextResponse } from "next/server";

import { explainAthleteProfile } from "@/lib/profile/explain-io";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/profile/explain — genera il commento AI "Spiega il mio profilo"
 * (docs/scheda_atleta_tooltip_e_commento.md §3).
 *
 * Route sottile sul modello di /api/profile/durability: verifica l'identità
 * Supabase e delega a explainAthleteProfile() (lib/profile/explain-io.ts).
 * L'AI riceve solo valori già calcolati e produce solo prosa — mai numeri
 * nuovi, mai decisioni.
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

  const result = await explainAthleteProfile(user.id);

  if (result.ok) {
    return NextResponse.json({
      success: true,
      comment: result.comment,
      generated_at: result.generated_at,
    });
  }

  switch (result.reason) {
    case "no_profile":
      return NextResponse.json(
        {
          success: false,
          error: "no_profile",
          message: "Costruisci prima la scheda atleta («Aggiorna profilo»).",
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
