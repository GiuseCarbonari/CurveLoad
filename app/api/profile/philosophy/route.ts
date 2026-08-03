import { NextResponse } from "next/server";

import { writeCoachingPhilosophy } from "@/lib/profile/philosophy-io";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/profile/philosophy — genera la filosofia di coaching dell'atleta.
 *
 * Route sottile sul modello di /api/profile/explain: verifica l'identità
 * Supabase e delega a writeCoachingPhilosophy() (lib/profile/philosophy-io.ts).
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

  const result = await writeCoachingPhilosophy(user.id);

  if (result.ok) {
    return NextResponse.json({
      success: true,
      philosophy: result.philosophy,
      generated_at: result.generated_at,
    });
  }

  switch (result.reason) {
    case "no_answers":
      return NextResponse.json(
        {
          success: false,
          error: "no_answers",
          message:
            "Prima rispondi alle domande in Impostazioni → La tua filosofia.",
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
          message: "Generazione della filosofia fallita, riprova tra poco.",
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
