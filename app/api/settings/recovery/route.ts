import { NextResponse, type NextRequest } from "next/server";

import { syncIntervalsData } from "@/lib/intervals/sync";
import { recoveryInputsFromPreferences } from "@/lib/recovery/baselines";
import { createClient } from "@/lib/supabase/server";

/**
 * Salva le risposte "Come recuperi" in `athlete_profiles.preferences.recovery`
 * (stesso pattern di /api/settings/hrv-protocol: nessuna colonna nuova,
 * nessuna migration da lanciare a mano su Supabase).
 *
 * Il body passa dallo STESSO normalizzatore che poi rileggerà il dato
 * (`recoveryInputsFromPreferences`): quello che non è valido diventa null e
 * non può stringere una soglia per sbaglio.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: "invalid_body" },
      { status: 400 }
    );
  }
  const recovery = recoveryInputsFromPreferences({ recovery: body });

  const { data: profile, error: readError } = await supabase
    .from("athlete_profiles")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    console.error("Lettura preferenze recupero fallita:", readError.message);
    return NextResponse.json(
      { success: false, error: "internal_error" },
      { status: 500 }
    );
  }

  const existingPreferences =
    profile?.preferences != null &&
    typeof profile.preferences === "object" &&
    !Array.isArray(profile.preferences)
      ? (profile.preferences as Record<string, unknown>)
      : {};

  const { error: saveError } = await supabase
    .from("athlete_profiles")
    .upsert(
      {
        user_id: user.id,
        preferences: { ...existingPreferences, recovery },
      },
      { onConflict: "user_id" }
    );
  if (saveError) {
    console.error("Salvataggio preferenze recupero fallito:", saveError.message);
    return NextResponse.json(
      { success: false, error: "internal_error" },
      { status: 500 }
    );
  }

  // Rigenera lo snapshot così le nuove soglie valgono subito, senza aspettare
  // il prossimo "Aggiorna dati". Le risposte restano salvate anche se
  // Intervals fosse irraggiungibile.
  const syncOutcome = await syncIntervalsData(user.id);

  return NextResponse.json({
    success: true,
    recovery,
    synced: syncOutcome.ok,
  });
}
